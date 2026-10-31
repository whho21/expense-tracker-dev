import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Linking,
  Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Camera, Check, History, Images, Plus, RefreshCw, Save, ScanLine, Settings, Sparkles, Trash2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { createReceiptClient } from "./src/api";
import { buildReceiptPurchases, prepareReceiptPhoto } from "./src/receipt";
import { reconcileReceiptItems } from "../src/utils/receiptItems";

const money = (value) => Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value).toFixed(2) : "--";
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

function Copy({ children, style, ...props }) {
  return <Text style={[styles.text, style]} {...props}>{children}</Text>;
}

function Action({ icon: Icon, label, onPress, disabled, primary, compact }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, primary && styles.primaryAction,
      compact && styles.compactAction, (disabled || pressed) && styles.dimmed]}>
    <Icon size={20} color={primary ? "#fff" : "#18231f"} />
    {!compact && <Copy style={[styles.actionText, primary && styles.lightText]}>{label}</Copy>}
  </Pressable>;
}

function Field({ label, value, onChangeText, disabled, numeric, ...props }) {
  return <View style={styles.field}>
    <Copy style={styles.label}>{label}</Copy>
    <TextInput accessibilityLabel={label} value={String(value ?? "")} onChangeText={onChangeText}
      editable={!disabled} keyboardType={numeric ? "decimal-pad" : "default"}
      style={[styles.input, disabled && styles.dimmed]} {...props} />
  </View>;
}

export default function App() {
  const [loaded, fontError] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold });
  if (!loaded && !fontError) return <ActivityIndicator accessibilityLabel="Loading app" style={styles.loading} />;
  return <SafeAreaProvider><ReceiptScreen /></SafeAreaProvider>;
}

function ReceiptScreen() {
  const [config, setConfig] = useState({
    receiptBaseUrl: process.env.EXPO_PUBLIC_RECEIPT_API_URL || (Platform.OS === "web" ? "http://localhost:3002" : ""),
    transactionBaseUrl: process.env.EXPO_PUBLIC_TRANSACTION_API_URL || (Platform.OS === "web" ? "http://localhost:3000" : ""),
  });
  const [configDraft, setConfigDraft] = useState(config);
  const [settingsOpen, setSettingsOpen] = useState(!config.receiptBaseUrl || !config.transactionBaseUrl);
  const [categories, setCategories] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [savedIds, setSavedIds] = useState([]);
  const [uncertain, setUncertain] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [categoryItem, setCategoryItem] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const operation = useRef(false);
  const mounted = useRef(true);
  const locked = savedIds.length > 0 || uncertain;
  const reconciliation = receipt ? reconcileReceiptItems(items, receipt.amount) : {};

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await createReceiptClient(config).categories();
        if (active) setCategories(result);
      } catch (err) {
        if (active) setError(err.message);
      }
    };
    void load();
    return () => { active = false; };
  }, [config]);

  const run = async (label, task) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(label);
    setError("");
    try {
      await task();
    } catch (err) {
      if (mounted.current) setError(err.message || "The request failed. Try again.");
    } finally {
      operation.current = false;
      if (mounted.current) setBusy("");
    }
  };

  const acceptAsset = async (asset) => {
    const prepared = await prepareReceiptPhoto(asset, async (uri, size, quality) => {
      const context = ImageManipulator.manipulate(uri);
      context.resize(size);
      const rendered = await context.renderAsync();
      return rendered.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
    });
    if (!mounted.current) return;
    setPhoto(prepared);
    setReceipt(null);
    setItems([]);
    setSavedIds([]);
    setReviewed(false);
    setUncertain(false);
    setMessage("");
  };

  useEffect(() => {
    const restore = async () => {
      if (Platform.OS !== "android" || operation.current) return;
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        if (pending && !pending.canceled && pending.assets?.[0]) await acceptAsset(pending.assets[0]);
      } catch (err) {
        if (mounted.current) setError(err.message);
      }
    };
    void restore();
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void restore(); });
    return () => subscription.remove();
  }, []);

  const choosePhoto = (camera) => {
    if (locked) return;
    const pick = async () => {
      if (camera && Platform.OS !== "web") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain) Alert.alert("Camera permission", "Enable camera access in your phone settings.", [
            { text: "Cancel", style: "cancel" }, { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]);
          throw new Error("Camera access was denied. You can select a receipt from Photos instead.");
        }
      }
      const result = await (camera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync)({
        mediaTypes: ["images"], allowsEditing: false, quality: 1,
      });
      if (!result.canceled && result.assets?.[0]) await acceptAsset(result.assets[0]);
    };
    void run("Preparing photo...", pick);
  };

  const scan = () => void run("Scanning receipt...", async () => {
    const result = await createReceiptClient(config).parse(photo);
    if (!mounted.current) return;
    const receiptId = randomUUID();
    const lines = Array.isArray(result.items) && result.items.length ? result.items : [{ description: result.merchant || "Purchase", amount: result.amount }];
    setReceipt({ ...result, id: receiptId, date: result.date || today(), amount: result.amount == null ? "" : String(result.amount) });
    setItems(lines.map((item) => ({ ...item, id: randomUUID(), description: item.description || "", amount: item.amount == null ? "" : String(item.amount), categoryId: "" })));
    setReviewed(false);
    setMessage("Receipt scanned.");
  });

  const updateItem = (id, updates) => {
    setReviewed(false);
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const changedDescription = Object.hasOwn(updates, "description");
      return { ...item, ...updates,
        ...(changedDescription ? { suggestion: null, categoryId: item.categorySource?.startsWith("jev") ? "" : item.categoryId,
          categorySource: item.categorySource?.startsWith("jev") ? null : item.categorySource } : {}),
        ...(Object.hasOwn(updates, "categoryId") ? { categorySource: "manual" } : {}),
      };
    }));
  };

  const suggest = () => void run("Suggesting categories...", async () => {
    setReviewed(false);
    const result = await createReceiptClient(config).categorize(receipt, items, categories);
    if (!Array.isArray(result.suggestions) || result.suggestions.length !== items.length ||
        new Set(result.suggestions.map((suggestion) => suggestion.itemId)).size !== items.length ||
        result.suggestions.some((suggestion) => !items.some((item) => item.id === suggestion.itemId) ||
          typeof suggestion.autoApply !== "boolean" ||
          ![suggestion.confidence, suggestion.probability].every((value) => typeof value === "number" && value >= 0 && value <= 1) ||
          (suggestion.categoryId === null && suggestion.autoApply) ||
          (suggestion.categoryId !== null && !categories.some((category) => category.id === suggestion.categoryId)))) {
      throw new Error("Invalid category suggestions. Choose categories manually.");
    }
    if (!mounted.current) return;
    setItems((current) => current.map((item) => {
      const suggestion = result.suggestions.find((candidate) => candidate.itemId === item.id);
      const automatic = item.categorySource === "jev";
      const apply = suggestion.autoApply && (!item.categoryId || automatic);
      return { ...item, suggestion: { ...suggestion, model: result.model },
        categoryId: apply ? suggestion.categoryId : automatic ? "" : item.categoryId,
        categorySource: apply ? "jev" : automatic ? null : item.categorySource };
    }));
    setMessage("Category suggestions ready.");
  });

  const save = () => void run("Saving purchases...", async () => {
    if (!reviewed || uncertain) throw new Error("Review the receipt before saving.");
    const purchases = buildReceiptPurchases(receipt, items, categories).filter((item) => !savedIds.includes(item.receiptLineId));
    const result = await createReceiptClient(config).save(purchases);
    if (!mounted.current) return;
    setSavedIds((ids) => [...ids, ...result.saved.map((item) => item.receiptLineId)]);
    if (result.error) {
      setUncertain(Boolean(result.uncertain));
      throw new Error(result.uncertain ? "Save status is uncertain. Check Transactions before importing this receipt again."
        : `${result.error}. Confirmed purchases remain saved; retry only the remaining purchases.`);
    }
    setMessage("All purchases saved.");
  });

  const loadHistory = () => void run("Loading transactions...", async () => {
    const records = await createReceiptClient(config).transactions();
    if (!mounted.current) return;
    setHistory(records.sort((left, right) => String(right.date).localeCompare(String(left.date))));
    setHistoryOpen(true);
  });

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}>
      <Image source={require("../src/assets/kakeibo.png")} style={styles.logo} accessibilityLabel="Kakeibo" />
      <View style={styles.brand}><Copy style={styles.brandName}>Kakeibo</Copy><Copy style={styles.subtle}>Receipt journal</Copy></View>
      <Action icon={History} label="Transactions" compact disabled={Boolean(busy)} onPress={loadHistory} />
      <Action icon={Settings} label="API Settings" compact disabled={Boolean(busy) || locked}
        onPress={() => { setConfigDraft(config); setSettingsOpen(true); }} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Copy style={styles.eyebrow}>MONEY MOVEMENT</Copy>
        <Copy style={styles.heading}>New receipt</Copy>
        <View style={styles.captureActions}>
          <Action icon={Camera} label="Take photo" primary disabled={Boolean(busy) || locked} onPress={() => choosePhoto(true)} />
          <Action icon={Images} label="Photos" disabled={Boolean(busy) || locked} onPress={() => choosePhoto(false)} />
        </View>
        {photo && <View style={styles.photoSection}>
          <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="contain" accessibilityLabel="Receipt preview" />
          {!receipt && <Action icon={ScanLine} label="Scan receipt" primary disabled={Boolean(busy)} onPress={scan} />}
        </View>}
        {Boolean(busy) && <View style={styles.status}><ActivityIndicator color="#087f5b" /><Copy accessibilityLiveRegion="polite">{busy}</Copy></View>}
        {Boolean(error) && <Copy style={styles.error} accessibilityRole="alert">{error}</Copy>}
        {Boolean(message) && <Copy style={styles.message} accessibilityLiveRegion="polite">{message}</Copy>}
        {receipt && <>
          <Field label="Merchant" value={receipt.merchant} maxLength={100} disabled={Boolean(busy) || locked}
            onChangeText={(merchant) => {
              setReceipt((current) => ({ ...current, merchant })); setReviewed(false);
              setItems((current) => current.map((item) => ({ ...item, suggestion: null,
                categoryId: item.categorySource?.startsWith("jev") ? "" : item.categoryId,
                categorySource: item.categorySource?.startsWith("jev") ? null : item.categorySource })));
            }} />
          <View style={styles.columns}>
            <Field label="Receipt total" value={receipt.amount} numeric disabled={Boolean(busy) || locked}
              onChangeText={(amount) => { setReceipt((current) => ({ ...current, amount })); setReviewed(false); }} />
            <Field label="Date (YYYY-MM-DD)" value={receipt.date} maxLength={10} disabled={Boolean(busy) || locked}
              onChangeText={(date) => { setReceipt((current) => ({ ...current, date })); setReviewed(false); }} />
          </View>
          <View style={styles.sectionHeader}>
            <Copy style={styles.sectionTitle}>Purchases{receipt.currency ? ` (${receipt.currency})` : ""}</Copy>
            <Action icon={Sparkles} label="Suggest categories" disabled={Boolean(busy) || locked || !categories.length || !items.length || items.some((item) => !item.description.trim())} onPress={suggest} />
          </View>
          {items.map((item, index) => <View key={item.id} style={styles.purchase}>
            <View style={styles.sectionHeader}><Copy style={styles.label}>PURCHASE {index + 1}</Copy>
              <Action icon={Trash2} label={`Remove purchase ${index + 1}`} compact disabled={Boolean(busy) || locked}
                onPress={() => { setItems((current) => current.filter((candidate) => candidate.id !== item.id)); setReviewed(false); }} /></View>
            <Field label={`Purchase ${index + 1}`} value={item.description} maxLength={100} disabled={Boolean(busy) || locked}
              onChangeText={(description) => updateItem(item.id, { description })} />
            {(item.quantity != null || item.unitPrice != null) && <Copy style={styles.subtle}>Quantity: {item.quantity ?? "--"} / Unit price: {money(item.unitPrice)}</Copy>}
            <View style={styles.columns}>
              <Field label={`Line total ${index + 1}`} value={item.amount} numeric disabled={Boolean(busy) || locked}
                onChangeText={(amount) => updateItem(item.id, { amount })} />
              <View style={styles.field}><Copy style={styles.label}>Category</Copy>
                <Pressable accessibilityRole="button" accessibilityLabel={`Category for purchase ${index + 1}`}
                  disabled={Boolean(busy) || locked} style={styles.input} onPress={() => setCategoryItem(item.id)}>
                  <Copy numberOfLines={1}>{categories.find((category) => category.id === item.categoryId)?.name || "Choose category"}</Copy>
                </Pressable>
              </View>
            </View>
            <Copy style={styles.subtle}>{savedIds.includes(item.id) ? "Saved" : "Allocated total"}: {money(reconciliation.amounts?.[index])}</Copy>
            {item.suggestion && <View style={styles.suggestion}>
              <Copy style={styles.subtle}>Jev: {categories.find((category) => category.id === item.suggestion.categoryId)?.name || "Unclassified"}. Confidence {Math.round(item.suggestion.confidence * 100)}%; probability {Math.round(item.suggestion.probability * 100)}%.{!item.suggestion.autoApply ? " Needs review." : ""}</Copy>
              {item.suggestion.categoryId && item.categoryId !== item.suggestion.categoryId && <Action icon={Check} compact
                label={`Use suggestion for purchase ${index + 1}`} disabled={Boolean(busy) || locked} onPress={() => {
                  setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate,
                    categoryId: item.suggestion.categoryId, categorySource: "jev-reviewed" } : candidate)); setReviewed(false);
                }} />}
            </View>}
          </View>)}
          <Action icon={Plus} label="Add purchase" disabled={Boolean(busy) || locked} onPress={() => {
            setItems((current) => [...current, { id: randomUUID(), description: "", amount: "", categoryId: "" }]); setReviewed(false);
          }} />
          <View style={styles.summary}>
            {[ ["Printed tax", receipt.tax], ["Printed discount", receipt.discount], ["Reviewed item total", reconciliation.itemTotal],
              ["Net adjustment", reconciliation.adjustment], ["Receipt total", receipt.amount] ].map(([label, value]) =>
              <View key={label} style={styles.summaryRow}><Copy>{label}</Copy><Copy style={styles.label}>{money(value)}</Copy></View>)}
          </View>
          {reconciliation.error && <Copy style={styles.error}>{reconciliation.error}</Copy>}
          <View style={styles.reviewRow}>
            <Switch accessibilityLabel="Approve receipt allocation" value={reviewed} onValueChange={setReviewed}
              disabled={Boolean(busy) || locked || Boolean(reconciliation.error)} trackColor={{ true: "#087f5b" }} />
            <Copy style={styles.reviewText}>{reconciliation.adjustment
              ? `I verified the purchases and approve the ${money(reconciliation.adjustment)} proportional net adjustment.`
              : "I verified the purchases and receipt total."}</Copy>
          </View>
          {savedIds.length > 0 && <Copy style={styles.subtle}>{savedIds.length} of {items.length} purchases saved.</Copy>}
          {savedIds.length === items.length && items.length > 0 ? <Action icon={Plus} label="New receipt" primary onPress={() => {
            setReceipt(null); setPhoto(null); setItems([]); setSavedIds([]); setReviewed(false); setMessage(""); setUncertain(false);
          }} /> : <Action icon={Save} label={savedIds.length ? "Retry remaining purchases" : "Save purchases"} primary
            disabled={Boolean(busy) || !reviewed || uncertain || Boolean(reconciliation.error)} onPress={save} />}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={settingsOpen} animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.sectionHeader}><Copy style={styles.heading}>API Settings</Copy><Action icon={X} label="Close settings" compact onPress={() => setSettingsOpen(false)} /></View>
        <Field label="Receipt API URL" value={configDraft.receiptBaseUrl} autoCapitalize="none" keyboardType="url"
          onChangeText={(receiptBaseUrl) => setConfigDraft((current) => ({ ...current, receiptBaseUrl }))} />
        <Field label="Transaction API URL" value={configDraft.transactionBaseUrl} autoCapitalize="none" keyboardType="url"
          onChangeText={(transactionBaseUrl) => setConfigDraft((current) => ({ ...current, transactionBaseUrl }))} />
        <Action icon={Check} label="Connect" primary onPress={() => {
          try { createReceiptClient(configDraft); setConfig(configDraft); setError(""); setSettingsOpen(false); }
          catch (err) { Alert.alert("API Settings", err.message); }
        }} />
      </ScrollView></SafeAreaView>
    </Modal>
    <Modal visible={categoryItem !== null} animationType="slide" onRequestClose={() => setCategoryItem(null)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}><Copy style={styles.heading}>Expense category</Copy><Action icon={X} label="Close categories" compact onPress={() => setCategoryItem(null)} /></View>
        {categories.map((category) => <Pressable key={category.id} accessibilityRole="button" accessibilityLabel={category.name} style={styles.categoryOption}
          onPress={() => { updateItem(categoryItem, { categoryId: category.id }); setCategoryItem(null); }}>
          <Copy style={styles.sectionTitle}>{category.name}</Copy>
        </Pressable>)}
      </ScrollView></SafeAreaView>
    </Modal>
    <Modal visible={historyOpen} animationType="slide" onRequestClose={() => setHistoryOpen(false)}>
      <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
        <View style={styles.sectionHeader}><Copy style={styles.heading}>Transactions</Copy>
          <Action icon={RefreshCw} label="Refresh transactions" compact disabled={Boolean(busy)} onPress={loadHistory} />
          <Action icon={X} label="Close transactions" compact onPress={() => setHistoryOpen(false)} /></View>
        {!history.length && <Copy>No transactions yet.</Copy>}
        {history.map((item) => <View key={item.id} style={styles.historyRow}>
          <View style={styles.flex}><Copy style={styles.label}>{item.description}</Copy><Copy style={styles.subtle}>{item.date}</Copy></View>
          <Copy style={styles.label}>{money(item.amount)}</Copy>
        </View>)}
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f6f2" },
  flex: { flex: 1 },
  loading: { flex: 1 },
  text: { fontFamily: "Manrope_400Regular", color: "#18231f", fontSize: 14, lineHeight: 21 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#e0e8e2" },
  logo: { width: 36, height: 36, resizeMode: "contain" },
  brand: { flex: 1 },
  brandName: { fontFamily: "Manrope_700Bold", fontSize: 18, lineHeight: 24 },
  content: { padding: 20, paddingBottom: 48, gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" },
  eyebrow: { color: "#66746b", fontSize: 11, fontFamily: "Manrope_700Bold" },
  heading: { fontFamily: "Manrope_700Bold", fontSize: 26, lineHeight: 34, flexShrink: 1 },
  subtle: { color: "#66746b", fontSize: 12, lineHeight: 19 },
  captureActions: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  action: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6, borderWidth: 1, borderColor: "#c5d2c9", backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, flexShrink: 1 },
  compactAction: { width: 44, paddingHorizontal: 0, flexShrink: 0 },
  primaryAction: { backgroundColor: "#087f5b", borderColor: "#087f5b" },
  actionText: { fontFamily: "Manrope_600SemiBold", flexShrink: 1 },
  lightText: { color: "#fff" },
  dimmed: { opacity: 0.5 },
  photoSection: { gap: 12 },
  photo: { width: "100%", height: 280, backgroundColor: "#e0e8e2", borderRadius: 6 },
  status: { flexDirection: "row", gap: 10, alignItems: "center" },
  error: { padding: 12, backgroundColor: "#fff0e9", color: "#963b2e", borderRadius: 6 },
  message: { color: "#087f5b" },
  field: { flex: 1, gap: 6, minWidth: 120 },
  label: { fontFamily: "Manrope_600SemiBold", fontSize: 12 },
  input: { borderWidth: 1, borderColor: "#c5d2c9", borderRadius: 6, backgroundColor: "#fff", minHeight: 46, paddingHorizontal: 10, paddingVertical: 10, fontFamily: "Manrope_400Regular", fontSize: 14, color: "#18231f", justifyContent: "center" },
  columns: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  sectionTitle: { fontFamily: "Manrope_600SemiBold", fontSize: 16 },
  purchase: { borderBottomWidth: 1, borderColor: "#c5d2c9", paddingVertical: 16, gap: 12 },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 8 },
  summary: { borderTopWidth: 1, borderColor: "#c5d2c9", paddingTop: 16, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  reviewText: { flex: 1, fontSize: 12, lineHeight: 19 },
  categoryOption: { paddingVertical: 18, borderBottomWidth: 1, borderColor: "#c5d2c9" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderColor: "#c5d2c9" },
});