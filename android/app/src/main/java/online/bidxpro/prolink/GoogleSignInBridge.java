package online.bidxpro.prolink;

import android.app.Activity;
import android.net.Uri;
import android.os.CancellationSignal;
import android.util.Log;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.Credential;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Collections;
import java.util.regex.Pattern;

/**
 * "Continue with Google" for the ProLink page: exposes window.BidxNativeGoogle
 * to the ProLink origin only (main frame), shows Android Credential Manager's
 * Sign in with Google account chooser (the Google accounts on the phone, plus
 * "Add account"), and replies with the Google ID token. The page signs in with
 * supabase.auth.signInWithIdToken(); Supabase verifies the token's signature,
 * audience (the Web client ID) and nonce.
 *
 * Request:  {"type":"googleSignIn","id":"<hex>","nonce":"<sha256 hex of the page's raw nonce>"}
 * Reply:    {"id":"<hex>","status":"success","idToken":"..."}
 *           {"id":"<hex>","status":"cancelled"}
 *           {"id":"<hex>","status":"error","code":"no_credential|no_token|network|config|busy|bad_request|unknown"}
 */
final class GoogleSignInBridge implements WebViewCompat.WebMessageListener {
    static final String JS_OBJECT = "BidxNativeGoogle";
    private static final String TAG = "BidxGoogleSignIn";
    private static final Pattern REQUEST_ID = Pattern.compile("^[0-9a-f]{1,64}$");
    private static final Pattern HASHED_NONCE = Pattern.compile("^[0-9a-f]{64}$");

    private final Activity activity;
    private final CredentialManager credentialManager;
    private final String webClientId;
    private CancellationSignal pending;

    private GoogleSignInBridge(Activity activity, String webClientId) {
        this.activity = activity;
        this.credentialManager = CredentialManager.create(activity);
        this.webClientId = webClientId;
    }

    /**
     * Returns null when this device's WebView cannot host the bridge (outdated
     * Android System WebView); the page then asks the person to update and keeps
     * email/password sign-in. Never throws, so a bridge problem cannot stop the app.
     */
    static GoogleSignInBridge install(Activity activity, WebView webView, String prolinkOrigin, String webClientId) {
        try {
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return null;
            GoogleSignInBridge bridge = new GoogleSignInBridge(activity, webClientId);
            WebViewCompat.addWebMessageListener(webView, JS_OBJECT, Collections.singleton(prolinkOrigin), bridge);
            return bridge;
        } catch (RuntimeException e) {
            Log.w(TAG, "Native Google sign-in bridge unavailable", e);
            return null;
        }
    }

    void cancel() {
        if (pending != null) pending.cancel();
        pending = null;
    }

    @Override
    public void onPostMessage(@NonNull WebView view, @NonNull WebMessageCompat message, @NonNull Uri sourceOrigin,
                              boolean isMainFrame, @NonNull JavaScriptReplyProxy replyProxy) {
        if (!isMainFrame) return;
        String id;
        String nonce;
        try {
            JSONObject request = new JSONObject(String.valueOf(message.getData()));
            String requestType = request.optString("type");
            if ("googleSignOut".equals(requestType)) {
                String signOutId = request.optString("id", "signout");
                if (!REQUEST_ID.matcher(signOutId).matches()) signOutId = "signout";
                clearCredentialProviderState(replyProxy, signOutId);
                return;
            }
            if (!"googleSignIn".equals(requestType)) return;
            id = request.getString("id");
            nonce = request.getString("nonce");
        } catch (JSONException e) {
            return;
        }
        if (!REQUEST_ID.matcher(id).matches()) return;
        if (!HASHED_NONCE.matcher(nonce).matches()) {
            reply(replyProxy, id, "error", "bad_request", null);
            return;
        }
        if (pending != null) {
            reply(replyProxy, id, "error", "busy", null);
            return;
        }

        // A missing Web client ID is a build/configuration problem, not a
        // missing Google account. Return a precise error before calling Google.
        if (webClientId == null || webClientId.trim().isEmpty()) {
            Log.e(TAG, "GOOGLE_WEB_CLIENT_ID is empty in this Android build");
            reply(replyProxy, id, "error", "config", null);
            return;
        }

        // This is an explicit "Continue with Google" button. Use Google's
        // dedicated button flow directly rather than first attempting the
        // account-picker flow, which can fail during AccountReauth with [16].
        // The server client ID MUST be the Web OAuth client ID, not the Android ID.
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(webClientId)
                .setNonce(nonce)
                .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(option)
                .build();
        CancellationSignal signal = new CancellationSignal();
        pending = signal;
        credentialManager.getCredentialAsync(activity, request, signal, ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse response) {
                        if (pending == signal) pending = null;
                        String idToken = idTokenFrom(response.getCredential());
                        if (idToken != null) reply(replyProxy, id, "success", null, idToken);
                        else reply(replyProxy, id, "error", "no_token", null);
                    }

                    @Override
                    public void onError(@NonNull GetCredentialException error) {
                        if (pending == signal) pending = null;
                        String code = errorCode(error);
                        Log.w(TAG, "Sign in with Google button flow failed (" + code + ")"
                                + "; exception=" + error.getClass().getSimpleName()
                                + "; type=" + error.getType()
                                + "; message=" + error.getMessage(), error);
                        replyDiagnostic(replyProxy, id, code, error);
                    }
                });
    }

    /**
     * Notify Google and every enabled credential provider when the user signs
     * out of ProLink. Without this, Credential Manager may retain an active
     * provider session and route the next sign-in through account reauthentication.
     */
    private void clearCredentialProviderState(JavaScriptReplyProxy replyProxy, String id) {
        try {
            credentialManager.clearCredentialStateAsync(
                    new ClearCredentialStateRequest(),
                    null,
                    ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<Void, ClearCredentialException>() {
                        @Override
                        public void onResult(Void result) {
                            Log.i(TAG, "Credential provider state cleared after ProLink sign-out");
                            reply(replyProxy, id, "success", null, null);
                        }

                        @Override
                        public void onError(@NonNull ClearCredentialException error) {
                            Log.w(TAG, "Could not clear credential provider state after sign-out: "
                                    + error.getMessage(), error);
                            reply(replyProxy, id, "error", "clear_failed", null);
                        }
                    });
        } catch (RuntimeException error) {
            Log.w(TAG, "Credential provider state clear could not start", error);
            reply(replyProxy, id, "error", "clear_failed", null);
        }
    }

    private static String idTokenFrom(Credential credential) {
        if (!(credential instanceof CustomCredential)
                || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            return null;
        }
        try {
            return GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
        } catch (Exception e) {
            Log.w(TAG, "Unreadable Google ID token credential", e);
            return null;
        }
    }

    private static String errorCode(GetCredentialException e) {
        if (e instanceof NoCredentialException) return "no_credential";
        String detail = String.valueOf(e.getMessage());
        // [28444] / [10] Developer console is not set up correctly: no Android OAuth
        // client for this package name + signing SHA-1 in the Web client's Cloud project.
        if (detail.contains("28444") || detail.contains("[10]") || detail.contains("Developer console")
                || detail.contains("DEVELOPER_ERROR")) return "config";
        if (detail.toLowerCase().contains("network")) return "network";
        return "unknown";
    }

    // Include the underlying Credential Manager exception in the bridge response.
    // The page previously replaced every authorization failure with one generic
    // message, hiding whether the cause was a missing OAuth client, account state,
    // Play Services, cancellation, or a device/network problem.
    private static void replyDiagnostic(JavaScriptReplyProxy replyProxy, String id, String code, GetCredentialException error) {
        try {
            String detail = error.getClass().getSimpleName()
                    + " | type=" + error.getType()
                    + " | message=" + String.valueOf(error.getMessage());
            if (detail.length() > 240) detail = detail.substring(0, 240);
            JSONObject reply = new JSONObject()
                    .put("id", id)
                    .put("status", "error")
                    .put("code", code)
                    .put("detail", detail);
            replyProxy.postMessage(reply.toString());
        } catch (JSONException | IllegalStateException ex) {
            Log.w(TAG, "Could not send Google sign-in diagnostic", ex);
        }
    }

    private static void reply(JavaScriptReplyProxy replyProxy, String id, String status, String code, String idToken) {
        try {
            JSONObject reply = new JSONObject().put("id", id).put("status", status);
            if (code != null) reply.put("code", code);
            if (idToken != null) reply.put("idToken", idToken);
            replyProxy.postMessage(reply.toString());
        } catch (JSONException | IllegalStateException e) {
            Log.w(TAG, "Could not reply to the page", e);
        }
    }
}
