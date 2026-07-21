package com.morphiq.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BodyCompositionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
