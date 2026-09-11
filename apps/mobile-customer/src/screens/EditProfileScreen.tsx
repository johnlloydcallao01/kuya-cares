import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { apiConfig } from '../config/environment';
import { uploadProfileImage, PickedImage } from '../services/account';

export default function EditProfileScreen() {
  const colors = useThemeColors();
  const { user, updateUser, token } = useAuth();
  const router = useRouter();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [middleName, setMiddleName] = useState(user?.middleName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Profile picture state
  const currentProfileImageUrl =
    user?.profilePicture?.cloudinaryURL || user?.profilePicture?.url || null;
  const [pickedImage, setPickedImage] = useState<PickedImage | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  useEffect(() => {
    const textChanged =
      firstName !== (user?.firstName ?? '') ||
      lastName !== (user?.lastName ?? '') ||
      (middleName || '') !== (user?.middleName ?? '') ||
      (username || '') !== (user?.username ?? '');
    const photoChanged = !!pickedImage || removePhoto;
    setHasChanges(textChanged || photoChanged);
  }, [firstName, lastName, middleName, username, user, pickedImage, removePhoto]);

  const handleRemovePhoto = () => {
    setPickedImage(null);
    setRemovePhoto(true);
    setShowPhotoOptions(false);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    setShowPhotoOptions(false);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Permission Needed',
            'Camera access is required to take a profile picture.',
          );
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'Permission Needed',
            'Photo library access is required to choose a profile picture.',
          );
          return;
        }
      }

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setPickedImage({ uri: asset.uri, mimeType: asset.mimeType, name: asset.fileName });
      setRemovePhoto(false);
    } catch (err) {
      console.error('Image pick error:', err);
      Alert.alert('Pick Failed', 'Could not select the image. Please try again.');
    }
  };

  const handleChangePhoto = () => {
    setShowPhotoOptions(true);
  };

  const showRemoveOption = removePhoto || !!pickedImage || !!currentProfileImageUrl;

  const displayUri = pickedImage?.uri ?? (removePhoto ? null : currentProfileImageUrl);

  const handleSave = async () => {
    if (!user?.id || !hasChanges) return;

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast) {
      Alert.alert('Required Fields', 'First name and last name are required.');
      return;
    }

    setSaving(true);
    try {
      let mediaDoc: any = null;

      // Upload new profile picture if picked
      if (pickedImage) {
        mediaDoc = await uploadProfileImage(pickedImage);
      }

      const payload: Record<string, string | null | number> = {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        middleName: middleName.trim() || null,
        username: username.trim() || null,
      };

      // Handle profile picture update
      if (pickedImage && mediaDoc?.id) {
        payload.profilePicture = mediaDoc.id;
      } else if (removePhoto && !pickedImage) {
        payload.profilePicture = null;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiConfig.payloadApiKey) {
        headers['Authorization'] = `users API-Key ${apiConfig.payloadApiKey}`;
      } else if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${apiConfig.baseUrl}/users/${user.id}?depth=2`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err?.errors?.[0]?.message ||
            err?.message ||
            'Failed to update profile',
        );
      }

      const responseData = await res.json();
      const updatedUser = responseData.doc || responseData;

      updateUser(updatedUser as any);

      Alert.alert('Profile Updated', 'Your profile has been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error('Profile update error:', err);
      Alert.alert(
        'Update Failed',
        err instanceof Error ? err.message : 'Could not save profile.',
      );
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text as string,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaView style={{ backgroundColor: colors.primary }} edges={['top']} />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: colors.surface,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 8, marginRight: 8, marginLeft: -8 }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: colors.text,
                flex: 1,
              }}
            >
              Edit Profile
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !hasChanges}
              style={{
                backgroundColor: hasChanges ? colors.primary : colors.border,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text
                  style={{
                    color: hasChanges ? colors.surface : colors.textSecondary,
                    fontWeight: '600',
                    fontSize: 14,
                  }}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Profile Picture */}
            <View style={{ alignItems: 'center', marginBottom: 28 }}>
              <TouchableOpacity
                onPress={handleChangePhoto}
                activeOpacity={0.7}
                style={{ alignItems: 'center' }}
                disabled={saving}
              >
                {displayUri ? (
                  <Image
                    source={{ uri: displayUri }}
                    style={{ width: 104, height: 104, borderRadius: 52 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 104,
                      height: 104,
                      borderRadius: 52,
                      backgroundColor: colors.primaryLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="person" size={44} color={colors.primary} />
                  </View>
                )}
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <Ionicons name="camera" size={16} color={colors.surface} />
                </View>
              </TouchableOpacity>
              <Text
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: colors.primary,
                  fontWeight: '600',
                }}
              >
                {removePhoto ? 'Add a profile photo' : 'Tap to change your profile photo'}
              </Text>
            </View>

            {/* Read-only email */}
            <View style={{ marginBottom: 20 }}>
              <Text style={labelStyle}>Email</Text>
              <View
                style={{
                  ...fieldStyle,
                  backgroundColor: colors.background,
                  opacity: 0.7,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                  {user?.email || '—'}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 4,
                }}
              >
                Contact support to change your email address.
              </Text>
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={labelStyle}>First Name *</Text>
              <TextInput
                style={fieldStyle}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={labelStyle}>Last Name *</Text>
              <TextInput
                style={fieldStyle}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={labelStyle}>Middle Name</Text>
              <TextInput
                style={fieldStyle}
                value={middleName}
                onChangeText={setMiddleName}
                placeholder="Optional"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <Text style={labelStyle}>Username</Text>
              <TextInput
                style={fieldStyle}
                value={username}
                onChangeText={setUsername}
                placeholder="Optional — choose a unique username"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Photo Options Modal */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setShowPhotoOptions(false)}
        >
          <Pressable
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: Platform.OS === 'ios' ? 32 : 24,
              paddingTop: 8,
            }}
            onPress={() => {}}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.border,
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />
            <Text
              style={{
                textAlign: 'center',
                fontSize: 13,
                fontWeight: '600',
                color: colors.textSecondary,
                letterSpacing: 0.5,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}
            >
              Profile Photo
            </Text>

            {showRemoveOption && (
              <TouchableOpacity
                onPress={handleRemovePhoto}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 17, color: '#ef4444', textAlign: 'center' }}>
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => pickImage('camera')}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderTopWidth: showRemoveOption ? 0 : 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 17, color: colors.text, textAlign: 'center' }}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => pickImage('library')}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 17, color: colors.text, textAlign: 'center' }}>
                Choose from Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowPhotoOptions(false)}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  color: colors.primary,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
