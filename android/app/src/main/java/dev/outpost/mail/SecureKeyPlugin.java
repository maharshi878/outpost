package dev.outpost.mail;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Iterator;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Holds the Resend API key and makes every request that needs it.
 *
 * - The key is encrypted with an AES-256-GCM key that lives in the Android Keystore. That key cannot be
 *   exported, and it is only usable by this app's UID. The ciphertext sits in app-private storage.
 * - The web layer never gets the key back. It sends "Bearer @vault" and this class swaps in the real key.
 * - Requests are only ever made to https://api.resend.com, redirects are not followed, so the key cannot
 *   be sent anywhere else even if the web layer is tampered with.
 */
@CapacitorPlugin(name = "SecureKey")
public class SecureKeyPlugin extends Plugin {
    private static final String ALIAS = "outpost_resend_key_v1";
    private static final String PREFS = "outpost_secure";
    private static final String PREF = "k";
    private static final String HOST = "api.resend.com";
    private static final String SENTINEL = "Bearer @vault";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey create(boolean strongBox) throws Exception {
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder b = new KeyGenParameterSpec.Builder(
                ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256);
        if (strongBox && Build.VERSION.SDK_INT >= 28) b.setIsStrongBoxBacked(true);
        g.init(b.build());
        return g.generateKey();
    }

    private SecretKey vaultKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return (SecretKey) ks.getKey(ALIAS, null);
        try { return create(true); } catch (Exception e) { return create(false); }
    }

    private boolean hardware() {
        try {
            SecretKey k = vaultKey();
            SecretKeyFactory f = SecretKeyFactory.getInstance(k.getAlgorithm(), "AndroidKeyStore");
            return ((KeyInfo) f.getKeySpec(k, KeyInfo.class)).isInsideSecureHardware();
        } catch (Exception e) {
            return false;
        }
    }

    private void store(String value) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, vaultKey());
        byte[] ct = c.doFinal(value.getBytes(StandardCharsets.UTF_8));
        String blob = Base64.encodeToString(c.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
        prefs().edit().putString(PREF, blob).commit();
    }

    private String load() {
        String blob = prefs().getString(PREF, null);
        if (blob == null) return null;
        try {
            String[] p = blob.split(":");
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, vaultKey(), new GCMParameterSpec(128, Base64.decode(p[0], Base64.NO_WRAP)));
            return new String(c.doFinal(Base64.decode(p[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            wipe(); // unreadable (for example the keystore was reset): treat as no key
            return null;
        }
    }

    private void wipe() {
        prefs().edit().remove(PREF).commit();
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
        } catch (Exception ignored) { }
    }

    @PluginMethod
    public void status(PluginCall call) {
        boolean has = load() != null;
        JSObject r = new JSObject();
        r.put("has", has);
        r.put("hardware", has && hardware());
        call.resolve(r);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String v = call.getString("value");
        if (v == null || v.isEmpty()) { call.reject("empty"); return; }
        try { store(v); call.resolve(); } catch (Exception e) { call.reject("Could not store the key securely"); }
    }

    /** One call removes the ciphertext and destroys the Keystore key. */
    @PluginMethod
    public void remove(PluginCall call) {
        wipe();
        call.resolve();
    }

    @PluginMethod
    public void request(PluginCall call) {
        try {
            String path = call.getString("path", "");
            String method = call.getString("method", "GET").toUpperCase();
            if (!path.startsWith("/") || !(method.equals("GET") || method.equals("POST") || method.equals("PUT") || method.equals("PATCH") || method.equals("DELETE"))) {
                call.reject("blocked");
                return;
            }
            URL url = new URL("https://" + HOST + path);
            if (!"https".equals(url.getProtocol()) || !HOST.equals(url.getHost()) || url.getUserInfo() != null) {
                call.reject("blocked");
                return;
            }
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(60000);
            conn.setRequestMethod(method);

            JSObject headers = call.getObject("headers");
            if (headers != null) {
                Iterator<String> it = headers.keys();
                while (it.hasNext()) {
                    String k = it.next();
                    String val = headers.getString(k);
                    if (val == null) continue;
                    if (k.equalsIgnoreCase("Authorization")) {
                        if (SENTINEL.equals(val)) {
                            String key = load();
                            if (key == null) { call.reject("No API key saved."); return; }
                            val = "Bearer " + key;
                        }
                        conn.setRequestProperty("Authorization", val);
                    } else if (k.equalsIgnoreCase("Content-Type") || k.equalsIgnoreCase("User-Agent") || k.equalsIgnoreCase("Idempotency-Key")) {
                        conn.setRequestProperty(k, val);
                    }
                }
            }

            String body = call.getString("body");
            if (body != null && !method.equals("GET")) {
                conn.setDoOutput(true);
                byte[] b = body.getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(b.length);
                try (OutputStream os = conn.getOutputStream()) { os.write(b); }
            }

            int code = conn.getResponseCode();
            InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            if (in != null) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                in.close();
            }
            JSObject r = new JSObject();
            r.put("status", code);
            r.put("body", out.toString("UTF-8"));
            String ra = conn.getHeaderField("Retry-After");
            if (ra != null) r.put("retryAfter", ra);
            conn.disconnect();
            call.resolve(r);
        } catch (Exception e) {
            call.reject("network");
        }
    }
}
