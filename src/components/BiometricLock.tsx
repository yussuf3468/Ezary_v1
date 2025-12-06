import { useState, useEffect } from "react";
import { Fingerprint, Lock, AlertCircle } from "lucide-react";

interface BiometricLockProps {
  onUnlock: () => void;
}

// Helper to convert string to ArrayBuffer
const stringToArrayBuffer = (str: string) => {
  return new TextEncoder().encode(str);
};

// Helper to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// Helper to convert base64 to ArrayBuffer
const base64ToArrayBuffer = (base64: string) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

export default function BiometricLock({ onUnlock }: BiometricLockProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  // Note: This component stores the credential ID in localStorage.
  // If localStorage is cleared, a new credential will be automatically registered.
  // The user will be prompted with Face ID again to set up the new credential.

  useEffect(() => {
    checkSupport();
  }, []);

  const checkSupport = async () => {
    try {
      if (!window.PublicKeyCredential) {
        setIsSupported(false);
        return;
      }

      const available =
        await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setIsSupported(available);

      if (available) {
        // Auto-trigger authentication
        setTimeout(() => {
          handleBiometricAuth();
        }, 500);
      }
    } catch (err) {
      console.error("Error checking biometric support:", err);
      setIsSupported(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsAuthenticating(true);
    setError(null);

    try {
      // Check if credential exists
      const storedCredentialId = localStorage.getItem("risq_credential_id");

      if (!storedCredentialId) {
        // Register new credential
        await registerBiometric();
      } else {
        try {
          // Try to authenticate with existing credential
          await authenticateBiometric(storedCredentialId);
        } catch (authErr: any) {
          // If authentication fails, the credential might be invalid
          // Clear it and try registering a new one
          if (
            authErr.name === "NotAllowedError" &&
            authErr.message.includes("not found")
          ) {
            console.log("Credential not found, re-registering...");
            localStorage.removeItem("risq_credential_id");
            await registerBiometric();
          } else {
            throw authErr; // Re-throw other errors
          }
        }
      }

      sessionStorage.setItem("biometric_unlocked", Date.now().toString());
      onUnlock();
    } catch (err: any) {
      console.error("Biometric authentication error:", err);

      // Handle specific error cases
      if (err.name === "NotAllowedError") {
        setError("Authentication cancelled or timed out. Please try again.");
      } else if (err.name === "InvalidStateError") {
        // Credential might be corrupted, clear it
        localStorage.removeItem("risq_credential_id");
        setError("Authentication setup needs to be reset. Please try again.");
      } else {
        setError(err.message || "Authentication failed. Please try again.");
      }

      setIsAuthenticating(false);
    }
  };

  const registerBiometric = async () => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKeyOptions: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "Risq Finance",
        id: window.location.hostname,
      },
      user: {
        id: stringToArrayBuffer("yussuf_muse"),
        name: "Yussuf Muse",
        displayName: "Yussuf Muse",
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" }, // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    };

    const credential = (await navigator.credentials.create({
      publicKey: publicKeyOptions,
    })) as PublicKeyCredential;

    if (credential) {
      const credentialId = arrayBufferToBase64(credential.rawId);
      localStorage.setItem("risq_credential_id", credentialId);
    }
  };

  const authenticateBiometric = async (credentialId: string) => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const publicKeyOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [
        {
          id: base64ToArrayBuffer(credentialId),
          type: "public-key",
          transports: ["internal"],
        },
      ],
      userVerification: "required",
      timeout: 60000,
    };

    await navigator.credentials.get({
      publicKey: publicKeyOptions,
    });
  };

  const handleManualUnlock = () => {
    handleBiometricAuth();
  };

  if (!isSupported) {
    // Fallback for unsupported devices
    sessionStorage.setItem("biometric_unlocked", Date.now().toString());
    onUnlock();
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Lock Icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-100 rounded-full">
              <Lock className="w-10 h-10 text-emerald-600" />
            </div>
          </div>

          {/* App Name */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Risq</h1>
          <p className="text-gray-600 mb-8">Yussuf Muse's Finance</p>

          {/* Biometric Icon */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-50 rounded-full relative">
              {isAuthenticating ? (
                <>
                  <Fingerprint className="w-12 h-12 text-emerald-600 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-4 border-emerald-600 animate-ping opacity-20"></div>
                </>
              ) : (
                <Fingerprint className="w-12 h-12 text-emerald-600" />
              )}
            </div>
          </div>

          {/* Status Message */}
          {isAuthenticating ? (
            <div className="mb-6">
              <p className="text-lg font-medium text-gray-900 mb-2">
                Authenticating
              </p>
              <div className="flex items-center justify-center gap-1">
                <div
                  className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-lg font-medium text-gray-900 mb-2">
                Touch to Unlock
              </p>
              <p className="text-sm text-gray-500">Use Face ID or Touch ID</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 text-left">{error}</p>
            </div>
          )}

          {/* Unlock Button */}
          {!isAuthenticating && (
            <button
              onClick={handleManualUnlock}
              className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
            >
              Unlock with Biometrics
            </button>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Lock className="w-4 h-4" />
              <span>Secured for Yussuf Muse</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
