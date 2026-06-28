package com.focustimermobile;

import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableMap;
import com.focustimermobile.shared.FocusTimerCore;
import java.util.ArrayList;
import java.util.List;

public class FocusTimerSharedModule extends ReactContextBaseJavaModule {
  public FocusTimerSharedModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "FocusTimerShared";
  }

  @ReactMethod
  public void formatDuration(double milliseconds, Promise promise) {
    promise.resolve(FocusTimerCore.INSTANCE.formatDuration((long) milliseconds));
  }

  @ReactMethod
  public void normalizeServerUrl(String value, Promise promise) {
    promise.resolve(FocusTimerCore.INSTANCE.normalizeServerUrl(value));
  }

  @ReactMethod
  public void isDateKey(String value, Promise promise) {
    promise.resolve(FocusTimerCore.INSTANCE.isDateKey(value));
  }

  @ReactMethod
  public void nextManualDailyPlanStatus(String currentStatus, Promise promise) {
    promise.resolve(FocusTimerCore.INSTANCE.nextManualDailyPlanStatus(currentStatus));
  }

  @ReactMethod
  public void calculateStreak(
      String todayKey,
      ReadableArray completedDates,
      Promise promise) {
    promise.resolve(FocusTimerCore.INSTANCE.calculateStreak(todayKey, toStringList(completedDates)));
  }

  @ReactMethod
  public void dailyPlanStatusForDate(
      String dateKey,
      ReadableArray completedDates,
      ReadableArray failedDates,
      ReadableArray neutralDates,
      String startDate,
      String todayKey,
      Promise promise) {
    promise.resolve(
        FocusTimerCore.INSTANCE.dailyPlanStatusForDate(
            dateKey,
            toStringList(completedDates),
            toStringList(failedDates),
            toStringList(neutralDates),
            startDate,
            todayKey));
  }

  @ReactMethod
  public void getCapabilities(Promise promise) {
    WritableMap capabilities = Arguments.createMap();
    capabilities.putString("logic", "kotlin-multiplatform");
    capabilities.putString("activeTarget", "android");
    promise.resolve(capabilities);
  }

  private List<String> toStringList(ReadableArray values) {
    List<String> result = new ArrayList<>();
    for (int index = 0; index < values.size(); index += 1) {
      String value = values.getString(index);
      if (value != null) {
        result.add(value);
      }
    }
    return result;
  }
}
