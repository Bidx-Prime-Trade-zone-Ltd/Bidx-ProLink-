package online.bidxpro.prolink;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
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
import android.webkit.JavascriptInterface;
import android.webkit.WebViewClient;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import android.widget.Toast;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int CAMERA_PERMISSION_REQUEST = 4102;
    private static final int LOCATION_PERMISSION_REQUEST = 4103;
    private static final int STARTUP_PERMISSION_REQUEST = 4104;
    private static final String HOME_URL = "https://app.bidxpro.online";
    private WebView webView;
    private volatile boolean navigationMenuOpen = false;
    private volatile boolean supportChatOpen = false;
    // React reports the active SPA tab. Do not infer it from WebView URL:
    // internal ProLink pages share the same origin and often the same path.
    private volatile boolean homeScreenActive = true;
    // React owns in-app navigation. WebView.canGoBack() alone is not reliable
    // for SPA pushState entries, so React keeps this native flag in sync.
    private volatile boolean spaCanGoBack = false;
    private android.window.OnBackInvokedCallback systemBackCallback;

    private void updatePullToRefreshState() {
        if (swipeRefreshLayout == null) return;
        boolean enabled = homeScreenActive && !navigationMenuOpen && !supportChatOpen;
        swipeRefreshLayout.setEnabled(enabled);
        if (!enabled) swipeRefreshLayout.setRefreshing(false);
    }

    private final class NativeUiBridge {
        @JavascriptInterface
        public void setMenuOpen(boolean open) {
            navigationMenuOpen = open;
            runOnUiThread(() -> updatePullToRefreshState());
        }

        @JavascriptInterface
        public void setSupportChatOpen(boolean open) {
            supportChatOpen = open;
            runOnUiThread(() -> updatePullToRefreshState());
        }

        @JavascriptInterface
        public void setHomeScreen(boolean active) {
            homeScreenActive = active;
            runOnUiThread(() -> updatePullToRefreshState());
        }

        @JavascriptInterface
        public void setCanGoBack(boolean canGoBack) {
            spaCanGoBack = canGoBack;
        }
    }
    private SwipeRefreshLayout swipeRefreshLayout;
    private GoogleSignInBridge googleSignIn;
    private static final int UPDATE_REQUEST_CODE = 4205;
    private AppUpdateManager appUpdateManager;
    private AlertDialog updateDialog;
    private AlertDialog installDialog;
    private boolean updateCheckInProgress = false;
    private final InstallStateUpdatedListener updateListener = state -> {
        // Immediate updates install and restart through Google Play. This is a
        // fallback for a previously-started flexible update: finish it as soon
        // as the download is ready instead of asking the user to tap again.
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            runOnUiThread(() -> appUpdateManager.completeUpdate()
                    .addOnFailureListener(error -> Log.e("ProLinkUpdate", "Could not complete downloaded update", error)));
        }
    };
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
        // Keep the WebView visible to Android Autofill so Google Password Manager
        // can offer to save and fill credentials in the embedded app experience.
        if (android.os.Build.VERSION.SDK_INT >= 26) {
            webView.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_YES);
        }
        swipeRefreshLayout.addView(webView, new SwipeRefreshLayout.LayoutParams(
                SwipeRefreshLayout.LayoutParams.MATCH_PARENT,
                SwipeRefreshLayout.LayoutParams.MATCH_PARENT));
        setContentView(swipeRefreshLayout);
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            systemBackCallback = this::handleBackNavigation;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    systemBackCallback);
        }
        appUpdateManager = AppUpdateManagerFactory.create(this);
        appUpdateManager.registerListener(updateListener);
        // Pull-to-refresh is enabled only on the home screen and only when the
        // WebView is already scrolled to the top. This prevents refresh gestures
        // from stealing normal vertical scrolling on any page.
        swipeRefreshLayout.setOnChildScrollUpCallback((parent, child) ->
                webView != null && webView.canScrollVertically(-1));
        swipeRefreshLayout.setOnRefreshListener(() -> {
            if (homeScreenActive && !navigationMenuOpen && !supportChatOpen && !webView.canScrollVertically(-1)) {
                webView.reload();
            } else {
                swipeRefreshLayout.setRefreshing(false);
            }
        });
        swipeRefreshLayout.setEnabled(false);

        webView.addJavascriptInterface(new NativeUiBridge(), "BidxNativeUI");
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
                    updatePullToRefreshState();
                }
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (swipeRefreshLayout != null) {
                    swipeRefreshLayout.setRefreshing(false);
                    updatePullToRefreshState();
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


    @Override
    protected void onResume() {
        super.onResume();
        checkForPlayUpdate();
    }

    private void checkForPlayUpdate() {
        if (appUpdateManager == null || updateCheckInProgress || isFinishing()) return;
        updateCheckInProgress = true;
        appUpdateManager.getAppUpdateInfo().addOnCompleteListener(task -> {
            updateCheckInProgress = false;
            if (!task.isSuccessful() || isFinishing()) return;
            AppUpdateInfo info = task.getResult();

            // If Play interrupted an immediate update (for example, the app was
            // backgrounded), resume that same installation flow automatically.
            if (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                startPlayUpdate(info);
                return;
            }

            if (info.installStatus() == InstallStatus.DOWNLOADED) {
                appUpdateManager.completeUpdate()
                        .addOnFailureListener(error -> Log.e("ProLinkUpdate", "Could not complete downloaded update", error));
                return;
            }

            if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    && (info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                        || info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))) {
                int availableVersion = info.availableVersionCode();
                int skippedVersion = getPreferences(MODE_PRIVATE)
                        .getInt("skipped_play_update_version", -1);
                if (availableVersion == skippedVersion) return;
                showAvailableUpdateDialog(info, availableVersion);
            }
        });
    }

    private void startPlayUpdate(AppUpdateInfo info) {
        try {
            int updateType = info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                    ? AppUpdateType.IMMEDIATE : AppUpdateType.FLEXIBLE;
            appUpdateManager.startUpdateFlowForResult(
                    info, updateType, this, UPDATE_REQUEST_CODE);
        } catch (android.content.IntentSender.SendIntentException error) {
            Log.e("ProLinkUpdate", "Could not launch the Google Play update flow", error);
            Toast.makeText(this, "Unable to start the update. Please try again later.", Toast.LENGTH_LONG).show();
        }
    }

    private void showAvailableUpdateDialog(AppUpdateInfo info, int availableVersion) {
        if (isFinishing() || (updateDialog != null && updateDialog.isShowing())) return;
        updateDialog = new AlertDialog.Builder(this)
                .setTitle("A new ProLink update is available")
                .setMessage("Version " + availableVersion + " is ready to install. Install it now or skip this version?")
                .setPositiveButton("Install", (dialog, which) -> startPlayUpdate(info))
                .setNegativeButton("Skip", (dialog, which) ->
                        getPreferences(MODE_PRIVATE).edit()
                                .putInt("skipped_play_update_version", availableVersion).apply())
                .create();
        updateDialog.setOnCancelListener(dialog ->
                getPreferences(MODE_PRIVATE).edit()
                        .putInt("skipped_play_update_version", availableVersion).apply());
        updateDialog.show();
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
        if (requestCode == UPDATE_REQUEST_CODE) {
            if (resultCode != RESULT_OK) checkForPlayUpdate();
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

    private void handleBackNavigation() {
        if (webView == null) {
            finish();
            return;
        }
        if (spaCanGoBack) {
            // Let React's popstate handler restore the previous tab, drawer,
            // profile, or overlay one entry at a time.
            webView.evaluateJavascript(
                    "(function(){if(typeof window.BidxHandleBack==='function' && window.BidxHandleBack())return true;" +
                    "if(window.history.length>1){window.history.back();return true;}return false;})()",
                    null);
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    @Override public void onBackPressed() {
        handleBackNavigation();
    }

    @Override protected void onDestroy() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && systemBackCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(systemBackCallback);
            systemBackCallback = null;
        }
        if (appUpdateManager != null) appUpdateManager.unregisterListener(updateListener);
        if (updateDialog != null && updateDialog.isShowing()) updateDialog.dismiss();
        if (installDialog != null && installDialog.isShowing()) installDialog.dismiss();
        if (googleSignIn != null) googleSignIn.cancel();
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}