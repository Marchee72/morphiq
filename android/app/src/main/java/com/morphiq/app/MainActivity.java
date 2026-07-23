package com.morphiq.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BodyCompositionPlugin.class);
        registerPlugin(ActiveWorkoutPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
