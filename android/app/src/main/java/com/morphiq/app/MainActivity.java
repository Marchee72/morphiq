package com.morphiq.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BodyCompositionPlugin.class);
        registerPlugin(ActiveWorkoutPlugin.class);
        registerPlugin(WellnessPlugin.class);
        // Only compiled in when the Samsung Health Data SDK's AAR is in app/libs.
        try {
            registerPlugin(Class.forName("com.morphiq.app.SamsungHealthPlugin").asSubclass(com.getcapacitor.Plugin.class));
        } catch (ClassNotFoundException ignored) {
        }
        super.onCreate(savedInstanceState);
    }
}
