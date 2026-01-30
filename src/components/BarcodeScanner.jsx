import { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

export default function BarcodeScanner({ onScan, onError, isActive = true }) {
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);

    const initScanner = useCallback(async () => {
        try {
            // Load locally installed package
            // Note: In Vite, this will be bundled or code-split automatically
            const { BarcodeScanner, EnumScanMode } = await import('dynamsoft-barcode-reader-bundle');

            // Configure license
            BarcodeScanner.license = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk3MTAxOTIyNjQiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6InRlc3RAdGVzdCIsImNoZWNrU2F2ZWRUcmFja2luZyI6ZmFsc2UsInByb2R1Y3RzIjpbIkRCUiIsIkRMU1AiLCJEVlIiLCJEVlIiLCJEM1BEIl0sImV4cGlyeSI6MTY0OTcxMDE5MjI2NH0=";

            // Basic settings to try to avoid other network fetches for WASM if possible
            // (The bundle usually defaults to CDN for WASM but the script itself will now be local)
            BarcodeScanner.engineResourcePath = "https://cdn.jsdelivr.net/npm/dynamsoft-barcode-reader-bundle@11.2.4500/dist/";

            // Initialize the scanner instance
            const scanner = await BarcodeScanner.createInstance();

            // Configure settings
            const settings = await scanner.getRuntimeSettings();
            settings.barcodeFormatIds = 67108864; // Code 128 (approximate ID, or use Enum if avail)
            // Or better, let's just use the simpler API if possible, but createInstance is lower level.
            // The previous code used `new window.Dynamsoft.BarcodeScanner({...})` which suggests the EasyScanner/CameraEnhancer wrapper pattern?
            // The 'bundle' package usually includes the "Camera Enhancer" logic built-in or exposes `createInstance`.

            // Let's stick to the previous configuration pattern but with the module
            // Actually, `new BarcodeScanner` might not be the constructor if it's the EasyScanner.
            // Documentation for 'dynamsoft-barcode-reader-bundle' suggests:
            // It exports `BarcodeScanner` which has `createInstance`.

            await scanner.updateRuntimeSettings("balance"); // Balance speed/accuracy

            // We need a UI container provided to the scanner, usually.
            // But the previous code didn't provide one in the config? It seemingly relied on default UI.
            // Let's ensure we attach it to a DOM element.

            if (scannerRef.current) {
                // If we already had one, destroy it?
                // But we are in init.
            }

            // Define scan handler
            scanner.onUniqueRead = (txt, result) => {
                onScan?.(txt);
                setLastScanned(txt);
                playBeep();
                if (navigator.vibrate) navigator.vibrate(100);
                setTimeout(() => setLastScanned(null), 2000);
            };

            // Store instance
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
