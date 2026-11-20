package com.example.planittcrm

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : ComponentActivity() {

    private lateinit var rootLayout: FrameLayout
    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>

    private val CHANNEL_ID = "planitt_crm_high_importance"
    private val PREFS_NAME = "planitt_crm_prefs"
    private val PREF_SERVER_URL = "server_url"
    private val DEFAULT_URL = "https://crm.planitt.in"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge window setup with safe window insets
        WindowCompat.setDecorFitsSystemWindows(window, false)

        createNotificationChannel()

        // Setup File Chooser Activity Result Launcher
        fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            if (result.resultCode == Activity.RESULT_OK) {
                val data = result.data
                val uris = when {
                    data?.clipData != null -> {
                        val count = data.clipData!!.itemCount
                        Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                    }
                    data?.data != null -> arrayOf(data.data!!)
                    else -> null
                }
                fileUploadCallback?.onReceiveValue(uris)
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
            fileUploadCallback = null
        }

        // Request Camera & Audio permissions for Google Meet
        requestAppPermissions()

        rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            fitsSystemWindows = false
            setBackgroundColor(Color.parseColor("#ffffff"))
        }

        // Apply Window Insets so WebView content is NEVER overlapped by status bar, camera notch, or navigation bar
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            windowInsets
        }

        // Setup WebView with Hardware Acceleration
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.parseColor("#ffffff"))
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
        }

        configureWebSettings(webView.settings)
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidApp")

        // Setup SwipeRefreshLayout (Pull-to-refresh)
        swipeRefreshLayout = SwipeRefreshLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setColorSchemeColors(
                Color.parseColor("#6366f1"),
                Color.parseColor("#3b82f6"),
                Color.parseColor("#10b981")
            )
            setProgressBackgroundColorSchemeColor(Color.parseColor("#1e293b"))
            setOnRefreshListener {
                webView.reload()
            }
            // Only trigger refresh when page is scrolled to the absolute top
            setOnChildScrollUpCallback { _, _ ->
                webView.scrollY > 0
            }
        }
        swipeRefreshLayout.addView(webView)

        // Setup Progress Bar
        progressBar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                8
            ).apply {
                gravity = Gravity.TOP
            }
            max = 100
            progress = 0
            visibility = View.VISIBLE
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                progressBar.visibility = View.GONE
                swipeRefreshLayout.isRefreshing = false
                applyThemeFromWeb(view)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("https://meet.google.com") || url.startsWith("tel:") || url.startsWith("mailto:") || url.startsWith("https://wa.me") || url.startsWith("whatsapp://")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        // fallback to webview
                    }
                }
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                if (newProgress >= 100) {
                    progressBar.visibility = View.GONE
                    swipeRefreshLayout.isRefreshing = false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                fileChooserLauncher.launch(intent)
                return true
            }
        }

        rootLayout.addView(swipeRefreshLayout)
        rootLayout.addView(progressBar)

        // Floating Server Settings Button (compact bottom-right pill)
        val configButton = ImageButton(this).apply {
            layoutParams = FrameLayout.LayoutParams(84, 84).apply {
                gravity = Gravity.BOTTOM or Gravity.END
                setMargins(0, 0, 32, 180) // positioned above bottom navigation bar
            }
            setImageResource(android.R.drawable.ic_menu_preferences)
            setBackgroundColor(Color.parseColor("#475569"))
            alpha = 0.55f
            setOnClickListener {
                showServerUrlDialog()
            }
        }
        rootLayout.addView(configButton)

        setContentView(rootLayout)

        // Back button navigation
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        val targetUrl = getSavedServerUrl()
        webView.loadUrl(targetUrl)
    }

    private fun configureWebSettings(settings: WebSettings) {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(true)
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Planitt CRM Alerts"
            val descriptionText = "High priority notifications for CRM leads, Google Meet calls, and tasks"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                lightColor = Color.BLUE
                enableVibration(true)
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun showNotification(title: String, body: String, url: String?) {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                if (!url.isNullOrEmpty()) {
                    putExtra("target_url", url)
                }
            }
            val pendingIntent: PendingIntent = PendingIntent.getActivity(
                context,
                System.currentTimeMillis().toInt(),
                intent,
                PendingIntent.FLAG_IMMUTABLE
            )

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)

            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
        }

        @JavascriptInterface
        fun getPlatform(): String {
            return "ANDROID_NATIVE"
        }

        @JavascriptInterface
        fun setStatusBarTheme(isDark: Boolean) {
            updateSystemBarsTheme(isDark)
        }
    }

    fun applyThemeFromWeb(view: WebView?) {
        view?.evaluateJavascript("document.documentElement.dataset.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light')") { rawTheme ->
            val theme = rawTheme?.replace("\"", "")?.trim()
            val isDark = theme == "dark"
            updateSystemBarsTheme(isDark)
        }
    }

    fun updateSystemBarsTheme(isDark: Boolean) {
        runOnUiThread {
            try {
                val insetsController = WindowCompat.getInsetsController(window, window.decorView)
                insetsController.isAppearanceLightStatusBars = !isDark
                insetsController.isAppearanceLightNavigationBars = !isDark

                val bgColor = if (isDark) Color.parseColor("#0f172a") else Color.parseColor("#ffffff")
                window.statusBarColor = bgColor
                window.navigationBarColor = bgColor
                if (::rootLayout.isInitialized) {
                    rootLayout.setBackgroundColor(bgColor)
                }
            } catch (_: Exception) {}
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECORD_AUDIO)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 1001)
        }
    }

    private fun getSavedServerUrl(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(PREF_SERVER_URL, DEFAULT_URL) ?: DEFAULT_URL
    }

    private fun saveServerUrl(url: String) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(PREF_SERVER_URL, url).apply()
    }

    private fun showServerUrlDialog() {
        val currentUrl = getSavedServerUrl()
        val input = EditText(this).apply {
            setText(currentUrl)
            hint = "e.g. https://crm.planitt.in or http://192.168.1.5:3000"
        }

        AlertDialog.Builder(this)
            .setTitle("Connect to Planitt CRM Server")
            .setMessage("Enter your frontend server URL (Cloud Production or Local Dev):")
            .setView(input)
            .setPositiveButton("Connect") { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.isNotEmpty()) {
                    val normalized = if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
                        "https://$newUrl"
                    } else {
                        newUrl
                    }
                    saveServerUrl(normalized)
                    webView.loadUrl(normalized)
                    Toast.makeText(this, "Connecting to $normalized", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .setNeutralButton("Reload") { _, _ ->
                webView.reload()
            }
            .show()
    }
}
