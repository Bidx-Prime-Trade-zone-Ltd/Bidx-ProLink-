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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int CAMERA_PERMISSION_REQUEST = 4102;
    private static final int LOCATION_PERMISSION_REQUEST = 4103;
    private static final int STARTUP_PERMISSION_REQUEST = 4104;
    private static final String HOME_URL = "https://app.bidxpro.online";
    private WebView webView;
    private SwipeRefreshLayout swipeRefreshLayout;
    private GoogleSignInBridge googleSignIn;
    private static final String PROLINK_ORIGIN = "https://app.bidxpro.online";
    private ValueCallback<Uri[]> filePathCallback;
    private PermissionRequest pendingWebPermission;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;

    private boolean isProLinkAppLink(Uri uri) {
        return uri != null
            && "https".equalsIgnoreCase(uri.getScheme())
            && "app.bidxpro.online".equalsIgnoreCase(uri.getHost());
    }

    // Pull-to-refresh is deliberately limited to the ProLink home page only.
    private boolean isHomeScreen(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        String path = uri.getPath();
        return isProLinkAppLink(uri) && (path == null || path.isEmpty() || "/".equals(path));
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

        swipeRefreshLayout = new SwipeRefreshLayout(this);
        webView = new WebView(this);
        swipeRefreshLayout.addView(webView, new SwipeRefreshLayout.LayoutParams(
                SwipeRefreshLayout.LayoutParams.MATCH_PARENT,
                SwipeRefreshLayout.LayoutParams.MATCH_PARENT));
        setContentView(swipeRefreshLayout);
        // Pull-to-refresh is enabled only on the home screen and only when the
        // WebView is already scrolled to the top. This prevents refresh gestures
        // from stealing normal vertical scrolling on any page.
        swipeRefreshLayout.setOnChildScrollUpCallback((parent, child) ->
                webView != null && webView.canScrollVertically(-1));
        swipeRefreshLayout.setOnRefreshListener(() -> {
            if (isHomeScreen(webView.getUrl()) && !webView.canScrollVertically(-1)) {
                webView.reload();
            } else {
                swipeRefreshLayout.setRefreshing(false);
            }
        });
        swipeRefreshLayout.setEnabled(false);

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
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                if (swipeRefreshLayout != null) {
                    swipeRefreshLayout.setRefreshing(false);
                    swipeRefreshLayout.setEnabled(isHomeScreen(url));
                }
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (swipeRefreshLayout != null) {
                    swipeRefreshLayout.setRefreshing(false);
                    swipeRefreshLayout.setEnabled(isHomeScreen(url));
                }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                String host = uri.getHost() == null ? "" : uri.getHost();
                // Keep every normal web link inside this WebView, including
                // links to other domains. Only non-web schemes (tel:, mailto:,
                // whatsapp:, and the OAuth app callback) are handed to Android.
                if (scheme.equals("http") || scheme.equals("https")) return false;
                if (isOAuthCallback(uri)) {
                    openIncomingAppLink(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                if (scheme.equals("tel") || scheme.equals("mailto") || scheme.equals("whatsapp")) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException ignored) { Toast.makeText(MainActivity.this, "No compatible app is available for this link", Toast.LENGTH_SHORT).show(); }
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
                Uri requestedOrigin = Uri.parse(origin);
                if (!"https".equalsIgnoreCase(requestedOrigin.getScheme()) ||
                    !"app.bidxpro.online".equalsIgnoreCase(requestedOrigin.getHost())) {
                    callback.invoke(origin, false, false);
                    return;
                }
                boolean fine = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                boolean coarse = checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                if (fine || coarse) {
                    callback.invoke(origin, true, false);
                } else {
                    if (pendingGeoCallback != null) pendingGeoCallback.invoke(pendingGeoOrigin, false, false);
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    requestPermissions(new String[]{
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    }, LOCATION_PERMISSION_REQUEST);
                }
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    Uri requestedOrigin = request.getOrigin();
                    if (!"https".equalsIgnoreCase(requestedOrigin.getScheme()) ||
                        !"app.bidxpro.online".equalsIgnoreCase(requestedOrigin.getHost())) {
                        request.deny();
                        return;
                    }
                    boolean asksForCamera = false;
                    for (String resource : request.getResources()) {
                        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) asksForCamera = true;
                    }
                    // Grant only camera capture. Audio and any unrecognized WebView
                    // resources are deliberately not granted by this app.
                    if (!asksForCamera) {
                        request.deny();
                    } else if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                    } else {
                        if (pendingWebPermission != null) pendingWebPermission.deny();
                        pendingWebPermission = request;
                        requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    }
                });
            }

            @Override public void onPermissionRequestCanceled(PermissionRequest request) {
                if (pendingWebPermission == request) pendingWebPermission = null;
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

        // Ask once at app startup for the three capabilities ProLink uses:
        // approximate/precise location, camera capture, and notifications.
        requestStartupPermissions();
    }

    private void requestStartupPermissions() {
        java.util.ArrayList<String> requested = new java.util.ArrayList<>();
        requested.add(Manifest.permission.ACCESS_FINE_LOCATION);
        requested.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        requested.add(Manifest.permission.CAMERA);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            requested.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        java.util.ArrayList<String> missing = new java.util.ArrayList<>();
        for (String permission : requested) {
            if (android.os.Build.VERSION.SDK_INT < 33 &&
                Manifest.permission.POST_NOTIFICATIONS.equals(permission)) continue;
            if (checkSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
                missing.add(permission);
            }
        }
        if (!missing.isEmpty()) {
            requestPermissions(missing.toArray(new String[0]), STARTUP_PERMISSION_REQUEST);
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
            PermissionRequest request = pendingWebPermission;
            pendingWebPermission = null;
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED)
                request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            else request.deny();
        } else if (requestCode == LOCATION_PERMISSION_REQUEST && pendingGeoCallback != null) {
            boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                              checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
            pendingGeoCallback = null;
            pendingGeoOrigin = null;
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