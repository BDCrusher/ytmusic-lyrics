/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.RippleDrawable;
import android.preference.*;
import android.view.View;
import android.widget.TextView;
import app.morphe.extension.shared.theme.ThemeUtils;

/** Scoped native preference rows. Keep framework widget binding, focus and accessibility. */
@SuppressWarnings("deprecation")
public final class FeaturePreferences {
    private FeaturePreferences() {}
    private static int dp(Context c,float n){return Math.round(n*c.getResources().getDisplayMetrics().density);}
    public static void card(View view,boolean clickable){
        int foreground=ThemeUtils.getAppForegroundColor();
        view.setBackground(clickable?new RippleDrawable(ColorStateList.valueOf((foreground&0xffffff)|0x18000000),
                null,new android.graphics.drawable.ColorDrawable(Color.WHITE)):null);
        Context context=view.getContext();
        view.setPaddingRelative(dp(context,20),dp(context,8),dp(context,20),dp(context,8));
        if(clickable)view.setMinimumHeight(dp(context,54));
    }
    private static void bind(View view){
        card(view,true);
        View title=view.findViewById(android.R.id.title),summary=view.findViewById(android.R.id.summary);
        int foreground=ThemeUtils.getAppForegroundColor();
        if(title instanceof TextView text){text.setTextColor(foreground);text.setTextSize(16);text.setSingleLine(false);text.setTypeface(null,Typeface.NORMAL);}
        if(summary instanceof TextView text){text.setTextColor((foreground&0xffffff)|0xb3000000);text.setTextSize(13);text.setMaxLines(8);text.setPadding(0,dp(view.getContext(),3),0,0);}
    }
    public static Preference action(Context c){return new Row(c);}
    public static SwitchPreference toggle(Context c){return new Toggle(c);}
    public static ListPreference choice(Context c){return new Choice(c);}
    public static EditTextPreference text(Context c){return new Text(c);}
    public static PreferenceCategory heading(Context c){return new Heading(c);}
    private static class Row extends Preference {Row(Context c){super(c);}@Override protected void onBindView(View v){super.onBindView(v);bind(v);}}
    private static final class Toggle extends SwitchPreference {Toggle(Context c){super(c);}@Override protected void onBindView(View v){super.onBindView(v);bind(v);}}
    private static final class Choice extends ListPreference {
        Choice(Context c){super(c);}
        @Override protected void onBindView(View v){super.onBindView(v);bind(v);}
        @Override protected void onPrepareDialogBuilder(android.app.AlertDialog.Builder builder){
            super.onPrepareDialogBuilder(builder);
            CharSequence[] entries=getEntries(),values=getEntryValues();
            if(entries==null||values==null||entries.length!=values.length)return;
            // The host themes preference rows separately from the framework dialog list.
            android.widget.ArrayAdapter<CharSequence> adapter=new android.widget.ArrayAdapter<>(getContext(),android.R.layout.simple_list_item_single_choice,entries){
                @Override public View getView(int position,View recycled,android.view.ViewGroup parent){
                    View row=super.getView(position,recycled,parent);
                    if(row instanceof TextView text){text.setTextColor(ThemeUtils.getAppForegroundColor());text.setSingleLine(false);text.setTextSize(16);}
                    return row;
                }
            };
            builder.setSingleChoiceItems(adapter,findIndexOfValue(getValue()),(dialog,index)->{
                String value=values[index].toString();if(callChangeListener(value))setValue(value);dialog.dismiss();
            });
        }
    }
    private static final class Text extends EditTextPreference {Text(Context c){super(c);}@Override protected void onBindView(View v){super.onBindView(v);bind(v);}}
    private static final class Heading extends PreferenceCategory {Heading(Context c){super(c);}@Override protected void onBindView(View v){super.onBindView(v);v.setPadding(dp(getContext(),20),dp(getContext(),16),dp(getContext(),20),dp(getContext(),6));if(v instanceof TextView t){t.setTextColor(ThemeUtils.getAppForegroundColor());t.setTextSize(14);t.setTypeface(null,Typeface.BOLD);}}}
}
