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
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int CAMERA_PERMISSION_REQUEST = 4102;
    private static final String HOME_URL = "https://app.bidxpro.online";
    private WebView webView;
    private GoogleSignInBridge googleSignIn;
    private static final String PROLINK_ORIGIN = "https://app.bidxpro.online";
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebPermission;

    private boolean isProLinkAppLink(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && "app.bidxpro.online".equalsIgnoreCase(uri.getHost());
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

        // Install the same native Credential Manager bridge used by Marketplace02.
        // It is restricted to the ProLink origin and returns the Google ID token
        // directly to the WebView without launching Chrome.
        googleSignIn = GoogleSignInBridge.install(this, webView, PROLINK_ORIGIN,
                BuildConfig.GOOGLE_WEB_CLIENT_ID);

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
        if (googleSignIn != null) googleSignIn.cancel();
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}