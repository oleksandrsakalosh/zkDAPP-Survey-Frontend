import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  Platform,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { poseidon1 } from 'poseidon-lite';
import { palette } from '@/theme/palette';
import {
  CREDENTIAL_TYPES,
  CredentialType,
  getCredentialTypeConfig,
  getDefaultAttributesForType,
} from '@/utils/credentialConfig';

type RequestBuilderStep = 'credential-type' | 'attributes' | 'review';

interface RequestBuilderState {
  step: RequestBuilderStep;
  selectedCredentialType: CredentialType | null;
  selectedAttributes: Set<string>;
  voteMessage: string;
  isLoading: boolean;
}

function parseVoteMessageToBigInt(voteMessage: string): bigint {
  const trimmed = voteMessage.trim();
  if (!trimmed) {
    throw new Error('Please type a vote message.');
  }
  try {
    return BigInt(trimmed);
  } catch {
    throw new Error('Vote message must be an integer value (for example: 1, 2, 42).');
  }
}

function computeVotePoseidonHex(voteMessage: string): string {
  const voteBigInt = parseVoteMessageToBigInt(voteMessage);
  const hashBigInt = poseidon1([voteBigInt]);
  return hashBigInt.toString(16).padStart(64, '0');
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function createNonceChallenge(requestId: string, voteMessage: string, selectedClaims: string[]): string {
  const canonicalClaims = [...selectedClaims].sort().join(',');
  const payload = `${requestId}|${voteMessage.trim()}|${canonicalClaims}`;
  return `nonce_challenge_${fnv1aHex(payload)}`;
}

interface RequestBuilderProps {
  onClose?: () => void;
}

export default function RequestBuilder({ onClose }: RequestBuilderProps) {
  const [state, setState] = useState<RequestBuilderState>({
    step: 'credential-type',
    selectedCredentialType: null,
    selectedAttributes: new Set(),
    voteMessage: '',
    isLoading: false,
  });

  const handleSelectCredentialType = (typeId: CredentialType) => {
    const defaultAttrs = getDefaultAttributesForType(typeId);
    setState({
      ...state,
      selectedCredentialType: typeId,
      selectedAttributes: new Set(defaultAttrs),
      step: 'attributes',
    });
  };

  const handleToggleAttribute = (attributeId: string) => {
    const newAttributes = new Set(state.selectedAttributes);
    if (newAttributes.has(attributeId)) {
      newAttributes.delete(attributeId);
    } else {
      newAttributes.add(attributeId);
    }
    setState({
      ...state,
      selectedAttributes: newAttributes,
    });
  };

  const handleNext = () => {
    if (state.step === 'attributes') {
      setState({
        ...state,
        step: 'review',
      });
    }
  };

  const handleBack = () => {
    if (state.step === 'attributes') {
      setState({
        ...state,
        step: 'credential-type',
        selectedCredentialType: null,
        selectedAttributes: new Set(),
        voteMessage: '',
      });
    } else if (state.step === 'review') {
      setState({
        ...state,
        step: 'attributes',
      });
    }
  };

  const handleSendRequest = async () => {
    if (!state.selectedCredentialType) return;

    setState({ ...state, isLoading: true });

    try {
      const credentialConfig = getCredentialTypeConfig(state.selectedCredentialType);
      if (!credentialConfig) {
        throw new Error('Invalid credential type');
      }

      const requestId = `req_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
      const voteMessage = state.voteMessage.trim();
      if (!voteMessage) {
        throw new Error('Please type a message to bind into nonceChallenge.');
      }
      const voteHash = computeVotePoseidonHex(voteMessage);
      const selectedClaims = Array.from(state.selectedAttributes);
      const nonce = createNonceChallenge(requestId, voteMessage, selectedClaims);
      const callbackUrl = `zkdappsurveyfrontend://auth?voteHash=${encodeURIComponent(
        voteHash,
      )}&requestedClaims=${encodeURIComponent(JSON.stringify(selectedClaims))}&nonceChallenge=${encodeURIComponent(
        nonce,
      )}`;

      const requestPayload = {
        version: '1.0',
        requestId,
        presentationType: 'sd-jwt',
        aud: 'zkdapp-survey-frontend',
        nonce,
        callbackUrl,
        ...(credentialConfig.credentialTypes
          ? { credentialTypes: credentialConfig.credentialTypes }
          : {}),
        credentialQuery: {
          vct: credentialConfig.vct,
          requestedClaims: selectedClaims,
        },
        options: {
          allowUserSelectSubset: true,
        },
      };

      const valeraUrl = `asitplus-wallet://share?action=share&callback=${encodeURIComponent(
        callbackUrl,
      )}&type=${encodeURIComponent(credentialConfig.vct)}&requestId=${encodeURIComponent(
        requestId,
      )}&requestedClaims=${encodeURIComponent(JSON.stringify(selectedClaims))}&request=${encodeURIComponent(JSON.stringify(requestPayload))}`;

      console.log('[RequestBuilder] Sending request to Valera:', {
        vct: credentialConfig.vct,
        requestedClaims: selectedClaims,
        requestId,
        nonceChallenge: nonce,
        voteMessage,
        voteHash,
      });

      // In some runtimes (Expo Go), canOpenURL may return false for custom schemes
      // even though openURL still works. Try opening directly and only show error on failure.
      await Linking.openURL(valeraUrl);

      // Dismiss the modal so auth-callback screen is visible when Valera redirects back
      console.log('✅ [RequestBuilder] Valera opened - closing modal to await callback');
      onClose?.();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send request',
        [{ text: 'OK' }],
      );
    } finally {
      setState({ ...state, isLoading: false });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with close button and step indicator */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {state.step === 'credential-type'
            ? 'Select Credential'
            : state.step === 'attributes'
              ? 'Select Attributes'
              : 'Review Request'}
        </Text>
        <Pressable
          onPress={onClose}
          disabled={state.isLoading}
          style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
        >
          <MaterialIcons name="close" size={24} color={palette.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {state.step === 'credential-type' && (
          <CredentialTypeScreen onSelect={handleSelectCredentialType} />
        )}

        {state.step === 'attributes' && state.selectedCredentialType && (
          <AttributeSelectionScreen
            credentialType={state.selectedCredentialType}
            selectedAttributes={state.selectedAttributes}
            onToggleAttribute={handleToggleAttribute}
          />
        )}

        {state.step === 'review' && state.selectedCredentialType && (
          <ReviewScreen
            credentialType={state.selectedCredentialType}
            selectedAttributes={state.selectedAttributes}
            voteMessage={state.voteMessage}
            onVoteMessageChange={(voteMessage) => setState({ ...state, voteMessage })}
          />
        )}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.footer}>
        {(state.step === 'attributes' || state.step === 'review') && (
          <Pressable
            onPress={handleBack}
            disabled={state.isLoading}
            style={({ pressed }) => [
              styles.button,
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Back</Text>
          </Pressable>
        )}

        {state.step === 'attributes' && (
          <Pressable
            onPress={handleNext}
            disabled={state.isLoading || state.selectedAttributes.size === 0}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              (pressed || state.selectedAttributes.size === 0) && styles.buttonPressed,
            ]}
          >
            <Text style={styles.buttonText}>Next</Text>
          </Pressable>
        )}

        {state.step === 'review' && (
          <Pressable
            onPress={handleSendRequest}
            disabled={state.isLoading || state.voteMessage.trim().length === 0}
            style={({ pressed }) => [
              styles.button,
              styles.primaryButton,
              (pressed || state.isLoading || state.voteMessage.trim().length === 0) && styles.buttonPressed,
            ]}
          >
            {state.isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Request from Valera</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function CredentialTypeScreen({
  onSelect,
}: {
  onSelect: (typeId: CredentialType) => void;
}) {
  return (
    <View>
      <Text style={styles.stepDescription}>
        Choose which credential you would like to request from your Valera wallet.
      </Text>

      {CREDENTIAL_TYPES.map((credentialType) => (
        <Pressable
          key={credentialType.id}
          onPress={() => onSelect(credentialType.id)}
          style={({ pressed }) => [styles.credentialCard, pressed && styles.credentialCardPressed]}
        >
          <View>
            <Text style={styles.credentialLabel}>{credentialType.label}</Text>
            <Text style={styles.credentialDescription}>{credentialType.description}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={palette.primary} />
        </Pressable>
      ))}
    </View>
  );
}

function AttributeSelectionScreen({
  credentialType,
  selectedAttributes,
  onToggleAttribute,
}: {
  credentialType: CredentialType;
  selectedAttributes: Set<string>;
  onToggleAttribute: (attributeId: string) => void;
}) {
  const config = getCredentialTypeConfig(credentialType);
  if (!config) return null;

  return (
    <View>
      <Text style={styles.stepDescription}>
        Select which attributes you want to share from your {config.label}.
      </Text>

      <View style={styles.attributesList}>
        {config.attributes.map((attribute) => (
          <Pressable
            key={attribute.id}
            onPress={() => onToggleAttribute(attribute.id)}
            style={styles.attributeItem}
          >
            <MaterialIcons
              name={selectedAttributes.has(attribute.id) ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color={palette.primary}
            />
            <Text style={styles.attributeLabel}>{attribute.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.selectedCount}>
        {selectedAttributes.size} attribute{selectedAttributes.size !== 1 ? 's' : ''} selected
      </Text>
    </View>
  );
}

function ReviewScreen({
  credentialType,
  selectedAttributes,
  voteMessage,
  onVoteMessageChange,
}: {
  credentialType: CredentialType;
  selectedAttributes: Set<string>;
  voteMessage: string;
  onVoteMessageChange: (value: string) => void;
}) {
  const config = getCredentialTypeConfig(credentialType);
  if (!config) return null;

  const selectedAttributeLabels = config.attributes
    .filter((attr) => selectedAttributes.has(attr.id))
    .map((attr) => attr.label);

  return (
    <View>
      <Text style={styles.stepDescription}>
        Review your request before sending it to Valera.
      </Text>

      <View style={styles.reviewCard}>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Credential Type</Text>
          <Text style={styles.reviewValue}>{config.label}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Attributes to Share</Text>
          <View>
            {selectedAttributeLabels.map((label, index) => (
              <React.Fragment key={index}>
                <Text style={styles.reviewAttributeItem}>• {label}</Text>
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Vote Msg</Text>
          <TextInput
            value={voteMessage}
            onChangeText={onVoteMessageChange}
            placeholder="e.g. vote_option_2"
            placeholderTextColor="#999"
            style={styles.messageInput}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.reviewSection}>
          <Text style={styles.reviewLabel}>Presentation Type</Text>
          <Text style={styles.reviewValue}>SD-JWT</Text>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Push content below the status bar so the header close button is touchable on Android
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
    backgroundColor: palette.background || '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  credentialCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  credentialCardPressed: {
    backgroundColor: '#f9f9f9',
  },
  credentialLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textPrimary,
    marginBottom: 4,
  },
  credentialDescription: {
    fontSize: 13,
    color: '#999',
  },
  attributesList: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  attributeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  attributeLabel: {
    fontSize: 14,
    marginLeft: 12,
    color: palette.textPrimary,
  },
  selectedCount: {
    fontSize: 13,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  reviewSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: palette.textPrimary,
  },
  reviewAttributeItem: {
    fontSize: 14,
    color: palette.textPrimary,
    marginVertical: 4,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#d8d8d8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#222',
    backgroundColor: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: palette.primary || '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: palette.primary || '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButtonText: {
    color: palette.primary || '#007AFF',
  },
  buttonPressed: {
    opacity: 0.6,
  },
});
