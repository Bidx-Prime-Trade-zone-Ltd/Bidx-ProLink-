package online.bidxpro.prolink;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.tasks.Task;
import org.json.JSONObject;
import android.widget.Toast;
import android.util.Log;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int CAMERA_PERMISSION_REQUEST = 4102;
    private static final int GOOGLE_SIGN_IN_REQUEST = 4103;
    private static final String HOME_URL = "https://app.bidxpro.online";
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebPermission;

    private boolean isProLinkAppLink(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && "app.bidxpro.online".equalsIgnoreCase(uri.getHost());
    }

    private final class NativeGoogleBridge {
        @android.webkit.JavascriptInterface
        public void signIn(String nonce, String hashedNonce) {
            runOnUiThread(() -> startNativeGoogleSignIn(nonce, hashedNonce));
        }
    }

    private void sendGoogleResult(String idToken, String error) {
        sendGoogleResult(idToken, error, true);
    }

    private void sendGoogleResult(String idToken, String error, boolean nonceIncluded) {
        try {
            JSONObject payload = new JSONObject();
            if (idToken != null) payload.put("idToken", idToken);
            if (error != null) payload.put("error", error);
            payload.put("nonceIncluded", nonceIncluded);
            String json = payload.toString();
            webView.post(() -> webView.evaluateJavascript(
                "window.__bidxGoogleSignInResult && window.__bidxGoogleSignInResult(" +
                JSONObject.quote(json) + ")", null));
        } catch (Exception ignored) {
            // Keep authentication errors inside the app without crashing the WebView.
        }
    }

    private static final String GOOGLE_AUTH_TAG = "BidxGoogleAuth";

    private void startNativeGoogleSignIn(String nonce, String hashedNonce) {
        Log.i(GOOGLE_AUTH_TAG, "Google sign-in started; web client configured=" +
            (BuildConfig.GOOGLE_WEB_CLIENT_ID != null && !BuildConfig.GOOGLE_WEB_CLIENT_ID.trim().isEmpty()));
        if (BuildConfig.GOOGLE_WEB_CLIENT_ID == null ||
            BuildConfig.GOOGLE_WEB_CLIENT_ID.trim().isEmpty()) {
            sendGoogleResult(null, "Google Sign-In is not configured in this Android build.");
            return;
        }
        try {
            CredentialManager manager = CredentialManager.create(this);
            requestGoogleCredential(manager, nonce, hashedNonce, true);
        } catch (Exception error) {
            Log.e(GOOGLE_AUTH_TAG, "Credential Manager initialization failed", error);
            sendGoogleResult(null, "Google sign-in could not start (" +
                error.getClass().getSimpleName() + "): " +
                (error.getMessage() == null ? "unknown initialization error" : error.getMessage()));
        }
    }

    private void requestGoogleCredential(CredentialManager manager, String nonce,
                                         String hashedNonce, boolean useButtonOption) {
        try {
            GetCredentialRequest.Builder requestBuilder = new GetCredentialRequest.Builder();
            if (useButtonOption) {
                Log.i(GOOGLE_AUTH_TAG, "Requesting Google Sign in with Google option");
                GetSignInWithGoogleOption option =
                    new GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                        .setNonce(hashedNonce)
                        .build();
                requestBuilder.addCredentialOption(option);
            } else {
                Log.i(GOOGLE_AUTH_TAG, "Retrying with Google ID credential option");
                GetGoogleIdOption option =
                    new GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                        .setNonce(hashedNonce)
                        .setAutoSelectEnabled(false)
                        .build();
                requestBuilder.addCredentialOption(option);
            }

            manager.getCredentialAsync(this, requestBuilder.build(), null, getMainExecutor(),
                new androidx.credentials.CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override public void onResult(GetCredentialResponse response) {
                        Log.i(GOOGLE_AUTH_TAG, "Google credential returned; parsing ID token");
                        handleGoogleCredential(response);
                    }

                    @Override public void onError(GetCredentialException error) {
                        Log.e(GOOGLE_AUTH_TAG,
                            "Google credential request failed; option=" +
                            (useButtonOption ? "sign_in_with_google" : "google_id") +
                            "; exception=" + error.getClass().getName() +
                            "; message=" + error.getMessage(), error);
                        if (useButtonOption) {
                            // Google Play services can reject the dedicated button flow on
                            // some device/account states. Retry through the standard ID option.
                            requestGoogleCredential(manager, nonce, hashedNonce, false);
                        } else if (error instanceof NoCredentialException) {
                            Log.w(GOOGLE_AUTH_TAG, "Credential Manager returned NoCredentialException; opening Google Play services sign-in fallback.");
                            launchLegacyGoogleSignIn();
                        } else {
                            String detail = error.getClass().getSimpleName() + ": " +
                                (error.getMessage() == null ? "no error message" : error.getMessage());
                            sendGoogleResult(null, "Google account authentication failed (" + detail + ").");
                        }
                    }
                });
        } catch (Exception error) {
            Log.e(GOOGLE_AUTH_TAG, "Google credential request threw; option=" +
                (useButtonOption ? "sign_in_with_google" : "google_id"), error);
            if (useButtonOption) {
                requestGoogleCredential(manager, nonce, hashedNonce, false);
            } else {
                sendGoogleResult(null, "Google sign-in failed (" +
                    error.getClass().getSimpleName() + "): " +
                    (error.getMessage() == null ? "unknown error" : error.getMessage()));
            }
        }
    }

    // Compatibility fallback for devices where Credential Manager reports no available
    // credentials even though a Google account is present on the device.
    private void launchLegacyGoogleSignIn() {
        try {
            GoogleSignInOptions options = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestIdToken(BuildConfig.GOOGLE_WEB_CLIENT_ID)
                .build();
            Intent signInIntent = GoogleSignIn.getClient(this, options).getSignInIntent();
            startActivityForResult(signInIntent, GOOGLE_SIGN_IN_REQUEST);
            Log.i(GOOGLE_AUTH_TAG, "Launched Google Play services compatibility sign-in.");
        } catch (Exception error) {
            Log.e(GOOGLE_AUTH_TAG, "Could not launch Google Play services sign-in fallback", error);
            sendGoogleResult(null, "Google sign-in could not open the account selector (" +
                error.getClass().getSimpleName() + ").");
        }
    }

    private void handleGoogleCredential(GetCredentialResponse response) {
        Credential credential = response.getCredential();
        Log.i(GOOGLE_AUTH_TAG, "Credential received; type=" + credential.getType());
        if (credential instanceof CustomCredential &&
            GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            try {
                GoogleIdTokenCredential googleCredential =
                    GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData());
                String idToken = googleCredential.getIdToken();
                Log.i(GOOGLE_AUTH_TAG, "Google ID token extracted successfully; token not logged");
                sendGoogleResult(idToken, null);
            } catch (Exception error) {
                Log.e(GOOGLE_AUTH_TAG, "Unable to parse Google ID token credential", error);
                sendGoogleResult(null, "Google returned an invalid sign-in credential (" +
                    error.getClass().getSimpleName() + "). Please try again.");
            }
        } else {
            Log.e(GOOGLE_AUTH_TAG, "Unsupported Google credential type=" + credential.getType());
            sendGoogleResult(null, "Google sign-in returned an unsupported credential.");
        }
    }

    private boolean isOAuthCallback(Uri uri) {
        return uri != null
            && "com.bidxpro.prolink".equalsIgnoreCase(uri.getScheme())
            && "auth".equalsIgnoreCase(uri.getHost())
            && "/callback".equals(uri.getPath());
    }

    private void openIncomingAppLink(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (webView == null || data == null) return;
        if (isOAuthCallback(data)) {
            // The callback is moved onto the app's own origin so Supabase JS can
            // exchange the PKCE code using the verifier stored in this WebView.
            Uri.Builder callback = Uri.parse(HOME_URL).buildUpon().appendPath("auth").appendPath("callback");
            if (data.getQuery() != null) callback.encodedQuery(data.getEncodedQuery());
            if (data.getFragment() != null) callback.encodedFragment(data.getEncodedFragment());
            webView.loadUrl(callback.build().toString());
        } else if (isProLinkAppLink(data)) {
            webView.loadUrl(data.toString());
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(7, 87, 183));
        getWindow().setNavigationBarColor(android.graphics.Color.BLACK);

        webView = new WebView(this);
        setContentView(webView);
        webView.addJavascriptInterface(new NativeGoogleBridge(), "BidxNativeGoogle");

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " BidxProLinkAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                String host = uri.getHost() == null ? "" : uri.getHost();
                if (scheme.equals("https") && (host.equals("app.bidxpro.online") || host.equals("bidxpro.online") || host.endsWith(".bidxpro.online"))) return false;
                if (scheme.equals("http") || scheme.equals("https") || scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("whatsapp")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "No app available to open this link", Toast.LENGTH_SHORT).show(); }
                    return true;
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = params.createIntent();
                try { startActivityForResult(intent, FILE_CHOOSER_REQUEST); }
                catch (ActivityNotFoundException e) { filePathCallback = null; Toast.makeText(MainActivity.this, "No file picker available", Toast.LENGTH_SHORT).show(); return false; }
                return true;
            }

            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    callback.invoke(origin, false, false);
                }
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    if (request.getResources().length > 0 &&
                        checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                    } else {
                        pendingWebPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    }
                });
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            openIncomingAppLink(getIntent());
        } else if (isProLinkAppLink(getIntent() == null ? null : getIntent().getData()) || isOAuthCallback(getIntent() == null ? null : getIntent().getData())) {
            openIncomingAppLink(getIntent());
        } else {
            webView.loadUrl(HOME_URL);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openIncomingAppLink(intent);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == GOOGLE_SIGN_IN_REQUEST) {
            try {
                Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
                GoogleSignInAccount account = task.getResult(com.google.android.gms.common.api.ApiException.class);
                String idToken = account == null ? null : account.getIdToken();
                if (idToken == null || idToken.isEmpty()) {
                    Log.e(GOOGLE_AUTH_TAG, "Google Play services sign-in completed without an ID token.");
                    sendGoogleResult(null, "Google did not return an ID token. Check the Web OAuth client configuration.");
                } else {
                    Log.i(GOOGLE_AUTH_TAG, "Google Play services returned an ID token; token not logged.");
                    sendGoogleResult(idToken, null, false);
                }
            } catch (Exception error) {
                Log.e(GOOGLE_AUTH_TAG, "Google Play services sign-in failed", error);
                sendGoogleResult(null, "Google sign-in failed (" + error.getClass().getSimpleName() +
                    (error.getMessage() == null ? "" : ": " + error.getMessage()) + ").");
            }
            return;
        }
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingWebPermission != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED)
                pendingWebPermission.grant(pendingWebPermission.getResources());
            else pendingWebPermission.deny();
            pendingWebPermission = null;
        }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) webView.saveState(outState);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}