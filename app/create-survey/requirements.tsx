import * as React from "react";
import { useMemo, useState } from "react";
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    ScrollView,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SurveyRequirement, RequirementType } from "@/domain/models";
import { palette } from "@/theme/palette";
import { useSurveyDraft } from "@/utils/SurveyDraftContext";
import { LocationModalPicker } from "@/components/LocationModalPicker";
import {
    getResidencePermitCountryByLabel,
    getResidencePermitCountryOptions,
    getResidencePermitDistricts,
    getResidencePermitRegions,
} from "@/utils/zk/residencePermitLocations";

const MANAGED_TYPES: RequirementType[] = ["Age", "Country", "Region", "District"];
const LEGACY_TYPES: RequirementType[] = ["Education level"];
const ALL_TYPES: RequirementType[] = [...MANAGED_TYPES, ...LEGACY_TYPES];
const COUNTRY_OPTIONS = getResidencePermitCountryOptions();
const LOCATION_TYPES: RequirementType[] = ["Country", "Region", "District"];

type RequirementGroup = "age" | "location";

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const placeholderByType: Record<Exclude<RequirementType, "">, string> = {
    Age: "18–35",
    Country: "Select a country",
    Region: "Select a region",
    District: "Select a district",
    Location: "Select a country",
    "Education level": "College+",
};

const isRequirementType = (value: string): value is Exclude<RequirementType, ""> => {
    return ALL_TYPES.includes(value as Exclude<RequirementType, "">);
};

const normalizeRequirementType = (value: string): RequirementType => {
    if (value === "Location") {
        return "Country";
    }

    return isRequirementType(value) ? value : "";
};

const isManagedRequirementType = (value: RequirementType): value is Exclude<RequirementType, "" | "Education level" | "Location"> => {
    return MANAGED_TYPES.includes(value as Exclude<RequirementType, "" | "Education level" | "Location">);
};

function parseLocationValue(value: string): { country: string; region: string; district: string } {
    const [country = "", region = "", district = ""] = value
        .split(" / ")
        .map((part) => part.trim())
        .concat(["", "", ""])
        .slice(0, 3);

    return { country, region, district };
}

function formatLocationValue(country: string, region = "", district = ""): string {
    return [country.trim(), region.trim(), district.trim()].filter(Boolean).join(" / ");
}

function parseMultiSelectValue(value: string): string[] {
    if (!value.trim()) return [];
    return value.split(",").map((v) => v.trim()).filter(Boolean);
}

function formatMultiSelectValue(values: string[]): string {
    return values.map((v) => v.trim()).filter(Boolean).join(", ");
}

function getDisplayValue(
    type: RequirementType,
    value: string,
    country?: string
): string {
    if (type === "Country") {
        return value;
    }
    if (type === "Region" || type === "District") {
        return formatMultiSelectValue(parseMultiSelectValue(value));
    }
    return value;
}

function getRequirementPlaceholder(type: RequirementType): string {
    return placeholderByType[type as Exclude<RequirementType, "">] ?? "Enter value";
}

function getRequirementGroup(type: RequirementType): RequirementGroup | null {
    if (type === "Age") {
        return "age";
    }

    if (LOCATION_TYPES.includes(type as (typeof LOCATION_TYPES)[number])) {
        return "location";
    }

    return null;
}

function isRequirementFilled(requirement: SurveyRequirement): boolean {
    if (!requirement.type.trim()) {
        return false;
    }

    if (requirement.type === "Age" || requirement.type === "Education level") {
        return requirement.value.trim().length > 0;
    }

    if (requirement.type === "Country") {
        return parseLocationValue(requirement.value).country.length > 0;
    }

    if (requirement.type === "Region") {
        const { country, region } = parseLocationValue(requirement.value);
        return country.length > 0 && region.length > 0;
    }

    if (requirement.type === "District") {
        const { country, region, district } = parseLocationValue(requirement.value);
        return country.length > 0 && region.length > 0 && district.length > 0;
    }

    return requirement.value.trim().length > 0;
}

type RequirementDropdownProps = {
    value: string;
    options: string[];
    placeholder?: string;
    isOpen: boolean;
    onOpen: () => void;
    onClose: () => void;
    onSelect: (value: string) => void;
    disabled?: boolean;
};

function RequirementDropdown({
    value,
    options,
    placeholder = "Select requirement",
    isOpen,
    onOpen,
    onClose,
    onSelect,
    disabled = false,
}: RequirementDropdownProps) {
    const handleSelect = (nextValue: string) => {
        onSelect(nextValue);
        onClose();
    };

    return (
        <View style={styles.dropdownWrap}>
            <Pressable
                style={[styles.dropdownField, disabled && styles.dropdownFieldDisabled]}
                onPress={disabled ? undefined : isOpen ? onClose : onOpen}
            >
                <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
                    {value || placeholder}
                </Text>
                <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color="#6B7280"
                />
            </Pressable>

            {isOpen && (
                <View style={styles.dropdownMenu}>
                    <ScrollView
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator
                        style={styles.dropdownMenuScroll}
                        contentContainerStyle={styles.dropdownMenuContent}
                    >
                        {!!value && (
                            <Pressable
                                style={styles.dropdownItem}
                                onPress={() => handleSelect("")}
                            >
                                <Text style={[styles.dropdownItemText, styles.clearOptionText]}>
                                    Clear selection
                                </Text>
                            </Pressable>
                        )}

                        {options.map((option) => {
                            const active = value === option;

                            return (
                                <Pressable
                                    key={option}
                                    style={[
                                        styles.dropdownItem,
                                        active && styles.dropdownItemActive,
                                    ]}
                                    onPress={() => handleSelect(option)}
                                >
                                    <Text
                                        style={[
                                            styles.dropdownItemText,
                                            active && styles.dropdownItemTextActive,
                                        ]}
                                    >
                                        {option}
                                    </Text>

                                    {active && (
                                        <Ionicons
                                            name="checkmark"
                                            size={16}
                                            color={palette.primary}
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}

export default function RequirementsStep() {
    const { draft, setDraft } = useSurveyDraft();

    const initialRequirements = useMemo<SurveyRequirement[]>(() => {
        if (draft.requirements?.length) {
            return draft.requirements.map((r) => ({
                id: r.id,
                type: normalizeRequirementType(r.type),
                value: r.value ?? "",
            }));
        }

        return [
            { id: makeId(), type: "Age", value: "" },
            { id: makeId(), type: "Country", value: "" },
        ];
    }, [draft.requirements]);

    const [requirements, setRequirements] = useState<SurveyRequirement[]>(initialRequirements);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
    const [activeModal, setActiveModal] = useState<{ id: string; type: "country" | "region" | "district" } | null>(null);

    const activeRequirements = useMemo(
        () => requirements.filter(isRequirementFilled),
        [requirements]
    );

    const selectedTypes = useMemo(
        () =>
            activeRequirements
                .map((r) => r.type)
                .filter((type): type is Exclude<RequirementType, ""> => isManagedRequirementType(type)),
        [activeRequirements]
    );

    const activeRequirementGroups = useMemo(() => {
        return new Set(
            activeRequirements
                .map((requirement) => getRequirementGroup(requirement.type))
                .filter((group): group is RequirementGroup => group !== null)
        );
    }, [activeRequirements]);

    const hasMixedRequirementGroups = activeRequirementGroups.size > 1;
    const activeRequirementGroup = hasMixedRequirementGroups
        ? null
        : activeRequirementGroups.values().next().value ?? null;

    const getAvailableTypes = (currentId: string): RequirementType[] => {
        const current = requirements.find((r) => r.id === currentId);
        const allowedTypes: RequirementType[] =
            activeRequirementGroup === "age"
                ? ["Age"]
                : activeRequirementGroup === "location"
                    ? LOCATION_TYPES
                    : MANAGED_TYPES;

        return [...allowedTypes, ...(current?.type === "Education level" ? ["Education level" as RequirementType] : [])].filter((type) => {
            if (type === current?.type) return true;
            return !selectedTypes.includes(type as Exclude<RequirementType, "">);
        });
    };

    const updateReq = (id: string, patch: Partial<SurveyRequirement>) => {
        setRequirements((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
        );
    };

    const removeReq = (id: string) => {
        setRequirements((prev) => prev.filter((r) => r.id !== id));
        setOpenDropdownKey((prev) => (prev?.startsWith(id) ? null : prev));
    };

    const addReq = () => {
        const allowedTypes =
            activeRequirementGroup === "age"
                ? ["Age"]
                : activeRequirementGroup === "location"
                    ? LOCATION_TYPES
                    : MANAGED_TYPES;

        const unusedType = allowedTypes.find(
            (type) => !selectedTypes.includes(type as Exclude<RequirementType, "">)
        ) as RequirementType | undefined;

        setRequirements((prev) => [
            ...prev,
            { id: makeId(), type: unusedType ?? "", value: "" },
        ]);
    };

    const getReqError = (r: SurveyRequirement): string | null => {
        if (!isRequirementFilled(r)) return null;

        if (r.type === "Age" || r.type === "Education level") {
            return null;
        }

        if (r.type === "Country") {
            return null;
        }

        if (r.type === "Region") {
            return null;
        }

        if (r.type === "District") {
            return null;
        }

        if (!r.value.trim()) return "Value is required for this requirement.";
        return null;
    };

    const groupError = hasMixedRequirementGroups
        ? "Use age requirements or location requirements, not both."
        : null;

    const allReqsValid = useMemo(
        () => !groupError && requirements.every((r) => getReqError(r) === null),
        [groupError, requirements]
    );

    const canAddMore = !groupError && selectedTypes.length < (activeRequirementGroup === "age" ? 1 : activeRequirementGroup === "location" ? 3 : MANAGED_TYPES.length);

    const updateLocationRequirement = (
        id: string,
        nextValue: Partial<{ country: string; region: string | string[]; district: string | string[] }>,
    ) => {
        const current = requirements.find((r) => r.id === id);
        if (!current) return;

        const parsed = parseLocationValue(current.value);

        if (current.type === "Country") {
            const country = typeof nextValue.country === "string" ? nextValue.country : "";
            updateReq(id, { value: formatLocationValue(country) });
            return;
        }

        if (current.type === "Region") {
            const country = typeof nextValue.country === "string" ? nextValue.country : parsed.country;
            const regions = Array.isArray(nextValue.region) ? nextValue.region : [];
            const regionValue = formatMultiSelectValue(regions);
            updateReq(id, { value: formatLocationValue(country, regionValue) });
            return;
        }

        if (current.type === "District") {
            const country = typeof nextValue.country === "string" ? nextValue.country : parsed.country;
            const region = typeof nextValue.region === "string" ? nextValue.region : parsed.region;
            const districts = Array.isArray(nextValue.district) ? nextValue.district : [];
            const districtValue = formatMultiSelectValue(districts);
            updateReq(id, { value: formatLocationValue(country, region, districtValue) });
        }
    };

    const normalizeAndSaveRequirements = () =>
        requirements
            .filter(isRequirementFilled)
            .map((r) => {
                if (r.type === "Country" || r.type === "Region" || r.type === "District") {
                    const { country, region, district } = parseLocationValue(r.value);
                    return {
                        id: r.id,
                        type: r.type,
                        value:
                            r.type === "Country"
                                ? country.trim()
                                : r.type === "Region"
                                    ? formatLocationValue(country, region)
                                    : formatLocationValue(country, region, district),
                    };
                }

                return {
                    id: r.id,
                    type: r.type,
                    value: r.value.trim(),
                };
            });

    const onNext = () => {
        setSubmitAttempted(true);
        if (!allReqsValid) return;

        const cleaned: SurveyRequirement[] = normalizeAndSaveRequirements();

        setDraft((p) => ({ ...p, requirements: cleaned }));
        router.push("/create-survey/review");
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={{ flex: 1 }}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
                        <Ionicons name="chevron-back" size={22} color="#111827" />
                    </Pressable>
                    <Text style={styles.headerTitle}>Create Survey</Text>
                </View>

                <View style={styles.sectionTop}>
                    <Text style={styles.sectionTitle}>Voter Requirements</Text>
                    <View style={styles.divider} />

                    <View style={styles.stepsRow}>
                        <View style={styles.stepPill} />
                        <View style={styles.stepPill} />
                        <View style={[styles.stepPill, styles.stepPillActive]} />
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.infoBox}>
                        <View style={styles.infoIconWrap}>
                            <Ionicons name="information" size={16} color={palette.primary} />
                        </View>
                        <Text style={styles.infoText}>
                            Set conditions voters must meet before they can participate. Leave empty to
                            allow anyone.
                        </Text>
                    </View>

                    {groupError && (
                        <View style={styles.groupErrorBox}>
                            <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                            <Text style={styles.groupErrorText}>{groupError}</Text>
                        </View>
                    )}

                    {requirements.map((r) => {
                        const err = submitAttempted ? getReqError(r) : null;
                        const valueError = submitAttempted && !!err && r.type !== "";
                        const typeError = false;
                        const availableTypes = getAvailableTypes(r.id);
                        const location = parseLocationValue(r.value);
                        const country = getResidencePermitCountryByLabel(location.country);
                        const regions = getResidencePermitRegions(country?.code);
                        const districts = getResidencePermitDistricts(country?.code, location.region);

                        return (
                            <View
                                key={r.id}
                                style={[styles.reqBlock, openDropdownKey?.startsWith(r.id) && styles.reqBlockOpen]}
                            >
                                <Pressable onPress={() => setOpenDropdownKey(null)}>
                                    <View style={styles.reqRow}>
                                        <View style={{ flex: 1 }}>
                                            <RequirementDropdown
                                                value={r.type}
                                                options={availableTypes}
                                                isOpen={openDropdownKey === `${r.id}:type`}
                                                onOpen={() => setOpenDropdownKey(`${r.id}:type`)}
                                                onClose={() => setOpenDropdownKey(null)}
                                                onSelect={(value) =>
                                                    updateReq(r.id, {
                                                        type: value as RequirementType,
                                                        value: "",
                                                    })
                                                }
                                            />
                                            {typeError && (
                                                <Text style={styles.inlineErrorText}>
                                                    Requirement is required.
                                                </Text>
                                            )}
                                        </View>

                                        <Pressable
                                            onPress={() => removeReq(r.id)}
                                            style={styles.trashBtn}
                                            hitSlop={10}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </Pressable>
                                    </View>

                                    {r.type === "Age" || r.type === "Education level" || r.type === "Location" ? (
                                        <>
                                            <TextInput
                                                value={r.value}
                                                onChangeText={(t) => updateReq(r.id, { value: t })}
                                                placeholder={getRequirementPlaceholder(r.type)}
                                                placeholderTextColor="#9CA3AF"
                                                style={[styles.reqInput, valueError && styles.inputError]}
                                            />

                                            {valueError && <Text style={styles.inlineErrorText}>{err}</Text>}
                                        </>
                                    ) : null}

                                    {r.type === "Country" && (
                                        <>
                                            <Pressable
                                                style={[styles.modalPickerButton, !location.country && styles.modalPickerButtonEmpty]}
                                                onPress={() => setActiveModal({ id: r.id, type: "country" })}
                                            >
                                                <Text style={[styles.modalPickerText, !location.country && styles.modalPickerTextEmpty]}>
                                                    {location.country || "Select a country"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color={location.country ? palette.primary : "#9CA3AF"} />
                                            </Pressable>
                                            {valueError && <Text style={styles.inlineErrorText}>{err}</Text>}
                                        </>
                                    )}

                                    {r.type === "Region" && (
                                        <>
                                            <Pressable
                                                style={styles.modalPickerButton}
                                                onPress={() => setActiveModal({ id: r.id, type: "country" })}
                                            >
                                                <Text style={[styles.modalPickerText, !location.country && styles.modalPickerTextEmpty]}>
                                                    {location.country || "Select a country"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color={location.country ? palette.primary : "#9CA3AF"} />
                                            </Pressable>

                                            <View style={{ height: 10 }} />

                                            <Pressable
                                                style={[
                                                    styles.modalPickerButton,
                                                    !location.country && styles.modalPickerButtonDisabled,
                                                    !parseMultiSelectValue(location.region).length && styles.modalPickerButtonEmpty,
                                                ]}
                                                onPress={() => location.country && setActiveModal({ id: r.id, type: "region" })}
                                                disabled={!location.country}
                                            >
                                                <Text style={[styles.modalPickerText, !parseMultiSelectValue(location.region).length && styles.modalPickerTextEmpty]}>
                                                    {getDisplayValue("Region", location.region) || "Select regions"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color={parseMultiSelectValue(location.region).length > 0 ? palette.primary : "#9CA3AF"} />
                                            </Pressable>

                                            {valueError && <Text style={styles.inlineErrorText}>{err}</Text>}
                                        </>
                                    )}

                                    {r.type === "District" && (
                                        <>
                                            <Pressable
                                                style={styles.modalPickerButton}
                                                onPress={() => setActiveModal({ id: r.id, type: "country" })}
                                            >
                                                <Text style={[styles.modalPickerText, !location.country && styles.modalPickerTextEmpty]}>
                                                    {location.country || "Select a country"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color={location.country ? palette.primary : "#9CA3AF"} />
                                            </Pressable>

                                            <View style={{ height: 10 }} />

                                            <Pressable
                                                style={[
                                                    styles.modalPickerButton,
                                                    !location.country && styles.modalPickerButtonDisabled,
                                                    !location.region.trim().length && styles.modalPickerButtonEmpty,
                                                ]}
                                                onPress={() => location.country && setActiveModal({ id: r.id, type: "region" })}
                                                disabled={!location.country}
                                            >
                                                <Text style={[styles.modalPickerText, !parseMultiSelectValue(location.region).length && styles.modalPickerTextEmpty]}>
                                                    {location.region || "Select region"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color={location.region.trim().length > 0 ? palette.primary : "#9CA3AF"} />
                                            </Pressable>

                                            <View style={{ height: 10 }} />

                                            <Pressable
                                                style={[
                                                    styles.modalPickerButton,
                                                    (!location.country || !location.region.trim().length) && styles.modalPickerButtonDisabled,
                                                    !parseMultiSelectValue(location.district).length && styles.modalPickerButtonEmpty,
                                                ]}
                                                onPress={() => location.country && location.region.trim().length > 0 && setActiveModal({ id: r.id, type: "district" })}
                                                disabled={!location.country || !location.region.trim().length}
                                            >
                                                <Text style={[styles.modalPickerText, !parseMultiSelectValue(location.district).length && styles.modalPickerTextEmpty]}>
                                                    {getDisplayValue("District", location.district) || "Select districts"}
                                                </Text>
                                                <Ionicons name="chevron-forward" size={18} color={parseMultiSelectValue(location.district).length > 0 ? palette.primary : "#9CA3AF"} />
                                            </Pressable>

                                            {valueError && <Text style={styles.inlineErrorText}>{err}</Text>}
                                        </>
                                    )}
                                </Pressable>
                            </View>
                        );
                    })}

                    <Pressable
                        onPress={addReq}
                        style={[styles.addReqBtn, !canAddMore && styles.addReqBtnDisabled]}
                        disabled={!canAddMore}
                    >
                        <Text style={styles.addReqPlus}>+</Text>
                        <Text style={[styles.addReqText, !canAddMore && styles.addReqTextDisabled]}>
                            Add requirement
                        </Text>
                    </Pressable>

                    {!canAddMore && (
                        <Text style={styles.helperText}>
                            All available requirements have already been added.
                        </Text>
                    )}

                    <View style={{ height: 110 }} />
                </ScrollView>

                <View style={styles.bottomBar}>
                    <Pressable style={styles.draftBtn} onPress={() => console.log("Save draft step3")}>
                        <Text style={styles.draftText}>Save as Draft</Text>
                    </Pressable>

                    <Pressable style={styles.nextBtn} onPress={onNext}>
                        <Text style={styles.nextText}>Review</Text>
                        <Text style={styles.nextArrow}>›</Text>
                    </Pressable>
                </View>

                {/* Country Modal */}
                {activeModal?.type === "country" && activeModal?.id && (() => {
                    const req = requirements.find((r) => r.id === activeModal.id);
                    const location = req ? parseLocationValue(req.value) : { country: "", region: "", district: "" };
                    return (
                        <LocationModalPicker
                            visible={activeModal?.type === "country"}
                            title="Select Country"
                            options={COUNTRY_OPTIONS.map((opt) => opt.label)}
                            selectedValue={location.country}
                            mode="single"
                            onConfirm={(value) => {
                                const selectedCountry = typeof value === "string" ? value : value[0] ?? "";
                                updateLocationRequirement(activeModal.id, { country: selectedCountry, region: [], district: [] });
                                setActiveModal(null);
                            }}
                            onCancel={() => setActiveModal(null)}
                        />
                    );
                })()}

                {/* Region Modal */}
                {activeModal?.type === "region" && activeModal?.id && (() => {
                    const req = requirements.find((r) => r.id === activeModal.id);
                    const location = req ? parseLocationValue(req.value) : { country: "", region: "", district: "" };
                    const country = getResidencePermitCountryByLabel(location.country);
                    const regionOptions = getResidencePermitRegions(country?.code);
                    const selectedRegions = parseMultiSelectValue(location.region);
                    const isDistrictRequirement = req?.type === "District";
                    return (
                        <LocationModalPicker
                            visible={activeModal?.type === "region"}
                            title={isDistrictRequirement ? "Select Region" : "Select Regions"}
                            options={regionOptions}
                            selectedValue={isDistrictRequirement ? location.region : selectedRegions}
                            mode={isDistrictRequirement ? "single" : "multi"}
                            maxSelections={5}
                            onConfirm={(value) => {
                                if (isDistrictRequirement) {
                                    const selected = typeof value === "string" ? value : value[0] ?? "";
                                    updateLocationRequirement(activeModal.id, { region: selected, district: [] });
                                } else {
                                    const selected = Array.isArray(value) ? value.slice(0, 5) : [value].filter(Boolean);
                                    updateLocationRequirement(activeModal.id, { region: selected, district: [] });
                                }
                                setActiveModal(null);
                            }}
                            onCancel={() => setActiveModal(null)}
                        />
                    );
                })()}

                {/* District Modal */}
                {activeModal?.type === "district" && activeModal?.id && (() => {
                    const req = requirements.find((r) => r.id === activeModal.id);
                    const location = req ? parseLocationValue(req.value) : { country: "", region: "", district: "" };
                    const country = getResidencePermitCountryByLabel(location.country);
                    const districtRegion = location.region.trim();
                    const districtOptions = districtRegion.length > 0
                        ? getResidencePermitDistricts(country?.code, districtRegion)
                        : [];
                    const selectedDistricts = parseMultiSelectValue(location.district);
                    return (
                        <LocationModalPicker
                            visible={activeModal?.type === "district"}
                            title="Select Districts"
                            options={districtOptions}
                            selectedValue={selectedDistricts}
                            mode="multi"
                            maxSelections={5}
                            onConfirm={(value) => {
                                const selected = Array.isArray(value) ? value.slice(0, 5) : [value].filter(Boolean);
                                updateLocationRequirement(activeModal.id, { district: selected });
                                setActiveModal(null);
                            }}
                            onCancel={() => setActiveModal(null)}
                        />
                    );
                })()}
            </View>
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

    stepsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
    stepPill: { flex: 1, height: 4, borderRadius: 999, backgroundColor: "#E5E7EB" },
    stepPillActive: { backgroundColor: palette.primary },

    content: { paddingHorizontal: 16, paddingTop: 14 },

    infoBox: {
        borderWidth: 1,
        borderColor: "#CFE3FF",
        backgroundColor: "#EEF4FF",
        borderRadius: 16,
        padding: 14,
        flexDirection: "row",
        gap: 12,
        marginBottom: 16,
    },
    infoIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderColor: "#CFE3FF",
        backgroundColor: palette.white,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    infoText: { flex: 1, color: palette.primary, fontWeight: "700", lineHeight: 20 },

    reqBlock: {
        marginBottom: 14,
        overflow: "visible",
    },
    reqBlockOpen: {
        zIndex: 30,
    },

    reqRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        zIndex: 20,
    },

    dropdownWrap: {
        position: "relative",
        zIndex: 50,
    },

    dropdownField: {
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        backgroundColor: palette.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    dropdownFieldDisabled: {
        backgroundColor: "#F9FAFB",
        opacity: 0.7,
    },
    dropdownText: {
        fontSize: 16,
        color: "#111827",
        fontWeight: "500",
    },
    dropdownPlaceholder: {
        color: "#9CA3AF",
        fontWeight: "400",
    },

    dropdownMenu: {
        position: "absolute",
        top: 58,
        left: 0,
        right: 0,
        maxHeight: 240,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: palette.white,
        paddingVertical: 6,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        zIndex: 999,
    },

    dropdownMenuScroll: {
        maxHeight: 228,
    },

    dropdownMenuContent: {
        paddingVertical: 0,
    },

    dropdownItem: {
        minHeight: 42,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    dropdownItemActive: {
        backgroundColor: "#F3F7FF",
    },

    dropdownItemText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#111827",
    },

    dropdownItemTextActive: {
        color: palette.primary,
        fontWeight: "800",
    },

    clearOptionText: {
        color: "#6B7280",
    },

    reqInput: {
        marginTop: 10,
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        fontSize: 16,
        color: "#111827",
        backgroundColor: palette.white,
    },

    trashBtn: {
        width: 54,
        height: 54,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#FECACA",
        backgroundColor: "#FEE2E2",
        alignItems: "center",
        justifyContent: "center",
    },

    inputError: {
        borderColor: "#EF4444",
        borderWidth: 1.5,
        backgroundColor: "#FEF2F2",
    },
    inlineErrorText: {
        marginTop: 6,
        color: "#EF4444",
        fontSize: 12,
        fontWeight: "700",
    },

    groupErrorBox: {
        marginHorizontal: 16,
        marginBottom: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 14,
        backgroundColor: "#FEF2F2",
        borderWidth: 1,
        borderColor: "#FECACA",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    groupErrorText: {
        flex: 1,
        color: "#B91C1C",
        fontSize: 13,
        fontWeight: "700",
    },

    addReqBtn: {
        marginTop: 8,
        height: 64,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: "#CFE3FF",
        borderStyle: "dashed",
        backgroundColor: "#EEF4FF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    addReqBtnDisabled: {
        opacity: 0.5,
    },
    addReqPlus: { fontSize: 20, fontWeight: "900", color: "#111827" },
    addReqText: { fontSize: 16, fontWeight: "900", color: palette.primary },
    addReqTextDisabled: { color: "#94A3B8" },

    helperText: {
        marginTop: 8,
        fontSize: 12,
        color: "#6B7280",
        fontWeight: "600",
    },

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

    modalPickerButton: {
        marginTop: 10,
        height: 54,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 16,
        paddingHorizontal: 14,
        backgroundColor: palette.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    modalPickerButtonEmpty: {
        backgroundColor: "#F9FAFB",
    },
    modalPickerButtonDisabled: {
        opacity: 0.5,
        backgroundColor: "#F9FAFB",
    },
    modalPickerText: {
        fontSize: 16,
        color: "#111827",
        fontWeight: "500",
        flex: 1,
    },
    modalPickerTextEmpty: {
        color: "#9CA3AF",
        fontWeight: "400",
    },
});
