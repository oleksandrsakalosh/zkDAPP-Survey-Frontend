import * as React from "react";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { useSurveyDraft } from "../../utils/SurveyDraftContext";
import { StyleSheet } from "react-native";
import { palette } from "@/theme/palette";


const TAGS = ["Politics", "Finance", "Health", "Education", "Community", "Technology"];

const formatDate = (d: Date) =>
  d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
  });

const toWebDateTimeValue = (date: Date | null) => {
  if (!date) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const parseWebDateTimeValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

type WebDateTimeInputProps = {
  value: Date | null;
  minimumDate?: Date | null;
  placeholder: string;
  hasError: boolean;
  onChange: (date: Date | null) => void;
};

function WebDateTimeInput({
  value,
  minimumDate,
  placeholder,
  hasError,
  onChange,
}: WebDateTimeInputProps) {
  return React.createElement("input", {
    type: "datetime-local",
    value: toWebDateTimeValue(value),
    min: toWebDateTimeValue(minimumDate ?? null) || undefined,
    "aria-label": placeholder,
    onChange: (event: { target: { value: string } }) =>
      onChange(parseWebDateTimeValue(event.target.value)),
    style: {
      flex: 1,
      height: 54,
      minWidth: 0,
      borderWidth: hasError ? 1.5 : 1,
      borderStyle: "solid",
      borderColor: hasError ? "#EF4444" : "#E5E7EB",
      borderRadius: 14,
      paddingLeft: 14,
      paddingRight: 14,
      fontSize: 16,
      color: value ? "#111827" : "#9CA3AF",
      backgroundColor: hasError ? "#FEF2F2" : palette.white,
      outline: "none",
      fontFamily: "inherit",
    },
  });
}

export default function CreateSurvey() {
  const { draft, setDraft } = useSurveyDraft();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"start" | "end">("start");
  const [androidPickerStep, setAndroidPickerStep] = useState<"date" | "time">("date");
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [descriptionHeight, setDescriptionHeight] = useState(120);

  const [touched, setTouched] = useState({
    name: false,
    description: false,
    duration: false,
  });

  // Data from global draft
  const surveyName = draft.name ?? "";
  const description = draft.description ?? "";
  const selected = draft.tags ?? [];
  const category = draft.category ?? "";

  const startDate = draft.startDate ? new Date(draft.startDate) : null;
  const endDate = draft.endDate ? new Date(draft.endDate) : null;

  const progress = useMemo(() => 0.25, []);

  // Draft setters
  const setName = (t: string) => setDraft((p) => ({ ...p, name: t }));
  const setDesc = (t: string) => setDraft((p) => ({ ...p, description: t }));
  const setCategory = (t: string) => setDraft((p) => ({ ...p, category: t }));

  const setStart = (d: Date | null) =>
    setDraft((p) => ({ ...p, startDate: d ? d.toISOString() : null }));

  const setEnd = (d: Date | null) =>
    setDraft((p) => ({ ...p, endDate: d ? d.toISOString() : null }));

  const toggleTag = (t: string) => {
    setDraft((p) => {
      const tags = (p.tags ?? []).includes(t)
        ? (p.tags ?? []).filter((x) => x !== t)
        : [...(p.tags ?? []), t];
      return { ...p, tags };
    });
  };

  // Validation
  const nameOk = surveyName.trim().length > 0;
  const descOk = description.trim().length > 0;
  const durationOk = !!startDate && !!endDate;
  const isValid = nameOk && descOk && durationOk;

  const nameError = touched.name && !nameOk;
  const descError = touched.description && !descOk;
  const durationError = touched.duration && !durationOk;

  const onNext = () => {
    setTouched({
      name: true,
      description: true,
      duration: true,
    });
  
    if (!isValid) return;
    router.push("/create-survey/questions");
  };

  // Date picker
  const openPicker = (mode: "start" | "end") => {
    setPickerMode(mode);
    const current = mode === "start" ? startDate : endDate;
    setTempDate(current ?? new Date());
    setAndroidPickerStep("date");
    setPickerOpen(true);
  };

  const onConfirm = (date: Date) => {
    if (pickerMode === "start") {
      setStart(date);
      if (endDate && endDate < date) setEnd(date);
    } else {
      if (startDate && date < startDate) setEnd(startDate);
      else setEnd(date);
    }
    setPickerOpen(false);
  };

  const onCancel = () => setPickerOpen(false);

  const onChangeAndroid = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      setPickerOpen(false);
      setAndroidPickerStep("date");
      return;
    }

    const chosen = selectedDate ?? tempDate;

    if (androidPickerStep === "date") {
      const nextDate = new Date(tempDate);
      nextDate.setFullYear(chosen.getFullYear(), chosen.getMonth(), chosen.getDate());
      setTempDate(nextDate);
      setAndroidPickerStep("time");
      return;
    }

    const finalDate = new Date(tempDate);
    finalDate.setHours(
      chosen.getHours(),
      chosen.getMinutes(),
      chosen.getSeconds(),
      chosen.getMilliseconds()
    );

    if (pickerMode === "start") {
      setStart(finalDate);
      if (endDate && endDate < finalDate) setEnd(finalDate);
    } else {
      if (startDate && finalDate < startDate) setEnd(startDate);
      else setEnd(finalDate);
    }

    setPickerOpen(false);
    setAndroidPickerStep("date");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Create Survey</Text>
        </View>

        {/* Section title + divider + progress */}
        <View style={styles.sectionTop}>
          <Text style={styles.sectionTitle}>Survey Details</Text>
          <View style={styles.divider} />

          <View style={styles.stepsRow}>
            <View style={[styles.stepPill, styles.stepPillActive]} />
            <View style={styles.stepPill} />
            <View style={styles.stepPill} />
            <View style={styles.stepPill} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Survey Name */}
          <Text style={styles.label}>Survey Name</Text>
          <TextInput
            placeholder="Enter survey title"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, nameError && styles.inputError]}
            value={surveyName}
            onChangeText={setName}
            onBlur={() => setTouched((p) => ({ ...p, name: true }))}
          />
          {nameError && <Text style={styles.errorText}>Required</Text>}

          {/* Description */}
          <Text style={[styles.label, { marginTop: 16 }]}>Description</Text>
          <TextInput
            placeholder="Describe what this survey is about..."
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              styles.textarea,
              { height: descriptionHeight },
              descError && styles.inputError,
            ]}
            multiline
            value={description}
            onChangeText={setDesc}
            onBlur={() => setTouched((p) => ({ ...p, description: true }))}
          />
          {descError && <Text style={styles.errorText}>Required</Text>}

          {/* Duration */}
          <Text style={[styles.label, { marginTop: 16 }]}>Duration</Text>

          {Platform.OS === "web" ? (
            <View style={styles.row}>
              <WebDateTimeInput
                value={startDate}
                placeholder="Start"
                hasError={durationError}
                onChange={(date) => {
                  setTouched((p) => ({ ...p, duration: true }));
                  setStart(date);
                  if (date && endDate && endDate < date) setEnd(date);
                }}
              />
              <WebDateTimeInput
                value={endDate}
                minimumDate={startDate}
                placeholder="End"
                hasError={durationError}
                onChange={(date) => {
                  setTouched((p) => ({ ...p, duration: true }));
                  if (date && startDate && date < startDate) setEnd(startDate);
                  else setEnd(date);
                }}
              />
            </View>
          ) : (
            <View style={styles.row}>
              <Pressable
                onPress={() => {
                  setTouched((p) => ({ ...p, duration: true }));
                  openPicker("start");
                }}
                style={[styles.dateBox, durationError && styles.inputError]}
              >
                <Text style={[styles.dateText, startDate ? styles.dateValue : styles.datePlaceholder]}>
                  {startDate ? formatDate(startDate) : "Start"}
                </Text>
                <View style={styles.dateIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color="#111827" />
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  setTouched((p) => ({ ...p, duration: true }));
                  openPicker("end");
                }}
                style={[styles.dateBox, durationError && styles.inputError]}
              >
                <Text style={[styles.dateText, endDate ? styles.dateValue : styles.datePlaceholder]}>
                  {endDate ? formatDate(endDate) : "End"}
                </Text>
                <View style={styles.dateIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color="#111827" />
                </View>
              </Pressable>
            </View>
          )}

          {durationError && <Text style={styles.errorText}>Select start and end dates</Text>}

          {/* ANDROID picker */}
          {Platform.OS === "android" && pickerOpen && (
            <DateTimePicker
              key={`${pickerMode}-${androidPickerStep}`}
              value={tempDate}
              mode={androidPickerStep}
              display="default"
              onChange={onChangeAndroid}
              minimumDate={
                androidPickerStep === "date" && pickerMode === "end" && startDate
                  ? startDate
                  : undefined
              }
            />
          )}

          {/* IOS modal picker */}
          {Platform.OS === "ios" && (
            <DateTimePickerModal
              isVisible={pickerOpen}
              mode="datetime"
              date={
                pickerMode === "start"
                  ? startDate ?? new Date()
                  : endDate ?? startDate ?? new Date()
              }
              onConfirm={onConfirm}
              onCancel={onCancel}
              minimumDate={pickerMode === "end" && startDate ? startDate : undefined}
            />
          )}
          

          {/* Category */}
          <Text style={[styles.label, { marginTop: 16 }]}>
            Category <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <TextInput
            placeholder="Enter category or tags"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            value={category}
            onChangeText={setCategory}
          />

          {/* Chips */}
          <View style={styles.chipsWrap}>
            {TAGS.map((t) => {
              const isOn = selected.includes(t);
              return (
                <Pressable
                  key={t}
                  onPress={() => toggleTag(t)}
                  style={[styles.chip, isOn ? styles.chipOn : styles.chipOff]}
                >
                  <Text style={[styles.chipText, isOn ? styles.chipTextOn : styles.chipTextOff]}>
                    + {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={() => console.log("Save as Draft")}
            style={({ pressed }) => [styles.draftBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.draftText}>Save as Draft</Text>
          </Pressable>

          <Pressable
            onPress={onNext}
            style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.nextText}>Next (1/4)</Text>
            <Text style={styles.nextArrow}>›</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.white },

  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.white,
  },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#111827" },

  sectionTop: { paddingHorizontal: 16, paddingBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  divider: { height: 2, backgroundColor: "#111827", marginTop: 8, borderRadius: 2 },

  progressRow: {
    height: 3,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    marginTop: 10,
    overflow: "hidden",
  },
  progressActive: { height: 3, backgroundColor: palette.primary },

  stepsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  stepPill: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" },
  stepPillActive: { backgroundColor: palette.primary },

  content: { paddingHorizontal: 16, paddingTop: 10 },

  label: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 8 },
  optional: { fontWeight: "700", color: "#6B7280" },

  input: {
    height: 54,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: palette.white,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 14,
    textAlignVertical: "top",
  },

  row: { flexDirection: "row", gap: 12 },
  dateBox: {
    flex: 1,
    height: 54,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.white,
  },
  dateText: {
    flex: 1,
    paddingRight: 10,
  },
  dateIconWrap: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  datePlaceholder: { fontSize: 16, color: "#9CA3AF" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipOn: { borderColor: palette.primary, backgroundColor: "#EEF4FF" },
  chipOff: { borderColor: "#E5E7EB", backgroundColor: palette.white },
  chipText: { fontSize: 14, fontWeight: "700" },
  chipTextOn: { color: palette.primary },
  chipTextOff: { color: "#6B7280" },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 12,
  },
  draftBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.white,
  },
  draftText: { fontSize: 16, fontWeight: "700", color: "#6B7280" },

  nextBtn: {
    flex: 1.4,
    height: 56,
    borderRadius: 16,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  nextText: { fontSize: 16, fontWeight: "800", color: palette.white },
  nextArrow: { color: palette.white, fontSize: 22, marginLeft: 10, marginTop: -1 },
  dateValue: { fontSize: 16, color: "#111827" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  modalSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },

  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  modalBtnText: { fontSize: 16, color: palette.primary },
  inputError: {
    borderColor: "#EF4444",
    borderWidth: 1.5,
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    marginTop: 6,
    color: "#EF4444",
    fontSize: 12,
  },
});
