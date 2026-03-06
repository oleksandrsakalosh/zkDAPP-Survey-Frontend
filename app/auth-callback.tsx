import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [credentialData, setCredentialData] = useState<any>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) {
      return;
    }

    const handleAuthCallback = async () => {
      try {
        hasProcessed.current = true;
        
        const credential = params.credential as string;
        const did = params.did as string;
        const timestamp = params.timestamp as string;
        
        let parsedCredential = null;
        if (credential) {
          try {
            parsedCredential = JSON.parse(credential);
          } catch {
            parsedCredential = credential;
          }
        }
        
        const receivedData = {
          credential: parsedCredential,
          did: did,
          timestamp: timestamp ? new Date(parseInt(timestamp)).toLocaleString() : 'N/A',
          receivedAt: new Date().toLocaleString(),
        };
        
        console.log('✅ CREDENTIAL SUCCESSFULLY RECEIVED FROM VALERA');
        console.log('  - DID:', did);
        console.log('  - Credential Type:', parsedCredential?.type || 'Unknown');
        console.log('  - Birth Year:', parsedCredential?.birthYear || 'N/A');
        console.log('  - Name:', parsedCredential?.name || 'N/A');
        console.log('  - Timestamp:', new Date(parseInt(timestamp)).toLocaleString());
        
        setCredentialData(receivedData);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setIsProcessing(false);
        
        setTimeout(() => {
          router.replace('/(tabs)/home');
        }, 10000);
        
      } catch (error) {
        console.error('Error processing authentication callback:', error);
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {isProcessing ? (
          <>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.text}>Processing authentication...</Text>
            <Text style={styles.subtext}>Receiving data from Valera wallet</Text>
          </>
        ) : (
          <>
            <Text style={styles.successText}>✓</Text>
            <Text style={styles.text}>Credential Received!</Text>
            <Text style={styles.subtext}>Redirecting to home...</Text>
            
            {credentialData && (
              <View style={styles.dataContainer}>
                <Text style={styles.dataTitle}>📋 Received Data:</Text>
                
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>DID:</Text>
                  <Text style={styles.dataValue}>{credentialData.did || 'N/A'}</Text>
                </View>
                
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Timestamp:</Text>
                  <Text style={styles.dataValue}>{credentialData.timestamp}</Text>
                </View>
                
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Received At:</Text>
                  <Text style={styles.dataValue}>{credentialData.receivedAt}</Text>
                </View>
                
                {credentialData.credential && (
                  <>
                    <Text style={styles.dataTitle}>🔐 Credential Details:</Text>
                    {typeof credentialData.credential === 'object' && (
                      <View style={styles.credentialSummary}>
                        <View style={styles.dataRow}>
                          <Text style={styles.dataLabel}>Name:</Text>
                          <Text style={styles.dataValue}>{credentialData.credential.name || 'N/A'}</Text>
                        </View>
                        <View style={styles.dataRow}>
                          <Text style={styles.dataLabel}>Birth Date:</Text>
                          <Text style={styles.dataValue}>
                            {credentialData.credential.birthYear 
                              ? `${credentialData.credential.birthMonth?.toString().padStart(2, '0')}/${credentialData.credential.birthDay?.toString().padStart(2, '0')}/${credentialData.credential.birthYear}`
                              : 'N/A'}
                          </Text>
                        </View>
                        <View style={styles.dataRow}>
                          <Text style={styles.dataLabel}>Age (2026):</Text>
                          <Text style={styles.dataValue}>
                            {credentialData.credential.birthYear 
                              ? `${2026 - credentialData.credential.birthYear} years`
                              : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    )}
                    <View style={styles.credentialBox}>
                      <Text style={styles.credentialText}>
                        {typeof credentialData.credential === 'string' 
                          ? credentialData.credential 
                          : JSON.stringify(credentialData.credential, null, 2)}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  text: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  successText: {
    fontSize: 64,
    color: '#4CAF50',
  },
  dataContainer: {
    width: '100%',
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  dataValue: {
    fontSize: 14,
    color: '#333',
    flex: 2,
    textAlign: 'right',
  },
  credentialSummary: {
    marginBottom: 12,
  },
  credentialBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    maxHeight: 300,
  },
  credentialText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#333',
  },
});
