package com.focustimermobile;

import android.app.Application;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactHost;
import com.facebook.react.ReactNativeApplicationEntryPoint;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultReactHost;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;

public class MainApplication extends Application implements ReactApplication {
  private ReactHost reactHost;

  @Override
  public ReactHost getReactHost() {
    if (reactHost == null) {
      List<ReactPackage> packages = new ArrayList<>(new PackageList(this).getPackages());
      packages.add(new FocusTimerSharedPackage());
      Function1<Exception, Unit> exceptionHandler =
          error -> {
            throw new RuntimeException(error);
          };
      reactHost =
          DefaultReactHost.getDefaultReactHost(
              getApplicationContext(),
              packages,
              "index",
              "index.android.bundle",
              null,
              null,
              BuildConfig.DEBUG,
              Collections.emptyList(),
              exceptionHandler,
              null);
    }
    return reactHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    ReactNativeApplicationEntryPoint.loadReactNative(this);
  }
}
