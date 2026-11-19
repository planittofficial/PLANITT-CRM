plugins {
  alias(libs.plugins.android.application)
}

android {
  namespace = "com.example.planittcrm"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.planitt.crm"
    minSdk = 24
    targetSdk = 35
    versionCode = 2
    versionName = "1.0.1"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  signingConfigs {
    create("release") {
      storeFile = file("planitt-release.keystore")
      storePassword = "planittcrm2025"
      keyAlias = "planitt"
      keyPassword = "planittcrm2025"
      enableV1Signing = true
      enableV2Signing = true
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.getByName("release")
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
    debug {
      signingConfig = signingConfigs.getByName("release")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  buildFeatures {
    compose = false
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.activity)
  implementation(libs.androidx.appcompat)
  implementation(libs.androidx.swiperefreshlayout)
  implementation(libs.androidx.lifecycle.runtime.ktx)
}
