import { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

export default function BarcodeScanner({ onScan, onError, isActive = true }) {
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);

    const initScanner = useCallback(async () => {
        try {
            // Load the library (side-effect import to populate window.Dynamsoft)
            await import('dynamsoft-barcode-reader-bundle');

            const Dynamsoft = window.Dynamsoft;
            if (!Dynamsoft) {
                throw new Error("Dynamsoft global not found after import");
            }

            // Configure license
            Dynamsoft.License.LicenseManager.initLicense("DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk3MTAxOTIyNjQiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6InRlc3RAdGVzdCIsImNoZWNrU2F2ZWRUcmFja2luZyI6ZmFsc2UsInByb2R1Y3RzIjpbIkRCUiIsIkRMU1AiLCJEVlIiLCJEVlIiLCJEM1BEIl0sImV4cGlyeSI6MTY0OTcxMDE5MjI2NH0=");

            // Point to local resources if needed (often needed for WASM)
            // But we will let it try default or CDN fallback if local fails
            // Dynamsoft.Core.CoreModule.engineResourcePaths = { ... } 

            let scanner;

            // Try newer API: CaptureVisionRouter or BarcodeScanner
            if (Dynamsoft.DBR && Dynamsoft.DBR.CaptureVisionRouter) {
                // v10+ Router approach? No, let's stick to BarcodeScanner which is the bundle wrapper
            }

            // The Bundle usually exposes 'BarcodeScanner' directly under Dynamsoft for easy use
            const ScannerClass = Dynamsoft.BarcodeScanner;

            if (ScannerClass.createInstance) {
                scanner = await ScannerClass.createInstance();
            } else {
                // Fallback to constructor
                scanner = new ScannerClass();
            }

            // Configure
            const settings = await scanner.getRuntimeSettings();
            // Code 128 ID: 1073741824 (from some docs) or 67108864 (legacy)
            // Safest: Use String if API supports it, or just rely on default (all)
            // settings.barcodeFormatIds = Dynamsoft.DBR.EnumBarcodeFormat.BF_CODE_128; 

            // We'll update settings to balance
            await scanner.updateRuntimeSettings("balance");

            scanner.onUniqueRead = (txt) => {
                onScan?.(txt);
                setLastScanned(txt);
                playBeep();
                if (navigator.vibrate) navigator.vibrate(100);
                setTimeout(() => setLastScanned(null), 2000);
            };

            scannerRef.current = scanner;
            setIsReady(true);

        } catch (err) {
            console.error('Scanner init error:', err);
            onError?.(err.message || 'Erreur initialisation scanner');
        }
    }, [onScan, onError]);

    const playBeep = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 1500;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) { }
    };

    useEffect(() => {
        initScanner();
        return () => {
            if (scannerRef.current) {
                scannerRef.current.dispose();
            }
        };
    }, []);

    useEffect(() => {
        if (!scannerRef.current) return;

        if (isActive && isReady) {
            // "show()" is the standard method for the UI-based scanner in the bundle
            // Legacy/other versions might use "launch()" or "open()"
            const scanner = scannerRef.current;
            const startMethod = scanner.show || scanner.launch || scanner.open;

            if (startMethod) {
                startMethod.call(scanner).catch(err => {
                    console.error('Launch error:', err);
                    onError?.(err.message);
                });
            } else {
                console.error("No start method found on scanner instance");
            }
        } else {
            // Hide if not active
            const scanner = scannerRef.current;
            if (scanner && scanner.hide) {
                scanner.hide();
            }
        }
    }, [isActive, isReady, onError]);

    return (
        <div className="barcode-scanner">
            <div className="scanner-container-placeholder">
                {/* Dynamsoft creates its own UI container upon launch */}
                {!isReady && (
                    <div className="scanner-loading">
                        <div className="loading-spinner"></div>
                        <p>Initialisation du scanner...</p>
                    </div>
                )}
                {lastScanned && (
                    <div className="scan-result-overlay">
                        <span className="result-icon">✓</span>
                        <span className="result-code">{lastScanned}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
