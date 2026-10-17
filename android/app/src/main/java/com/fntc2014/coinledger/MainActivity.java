package com.fntc2014.coinledger;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LedgerVisionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
