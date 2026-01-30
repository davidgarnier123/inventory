import { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

export default function BarcodeScanner({ onScan, onError, isActive = true }) {
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);

    const initScanner = useCallback(async () => {
        try {
            // Import the bundle
            // The docs say "import via package manager", usually implies named exports or default
            const DynamsoftBundle = await import('dynamsoft-barcode-reader-bundle');

            // Extract the class and Enums
            // In many bundles, it's either named export or default.BarcodeScanner
            const BarcodeScanner = DynamsoftBundle.BarcodeScanner || DynamsoftBundle.default?.BarcodeScanner || window.Dynamsoft?.BarcodeScanner;
            const EnumScanMode = DynamsoftBundle.EnumScanMode || DynamsoftBundle.default?.EnumScanMode || window.Dynamsoft?.EnumScanMode;

            if (!BarcodeScanner) {
                console.error("Bundle exports:", DynamsoftBundle);
                throw new Error("Could not find BarcodeScanner class in the bundle.");
            }

            // Configure Resource Path (Critical for NPM usage as per docs)
            // Docs say: "When using npm/yarn, you need to configure engineResourcePaths"
            // It might be a static property or on a config object.
            // Common pattern for this bundle:
            if (BarcodeScanner.engineResourcePath !== undefined) {
                BarcodeScanner.engineResourcePath = "https://cdn.jsdelivr.net/npm/dynamsoft-barcode-reader-bundle@11.2.4000/dist/";
            }

            // Define License
            const licenseKey = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk3MTAxOTIyNjQiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6InRlc3RAdGVzdCIsImNoZWNrU2F2ZWRUcmFja2luZyI6ZmFsc2UsInByb2R1Y3RzIjpbIkRCUiIsIkRMU1AiLCJEVlIiLCJEVlIiLCJEM1BEIl0sImV4cGlyeSI6MTY0OTcxMDE5MjIyNjR9";

            // Instantiate and Launch
            // Pattern: new BarcodeScanner(config).launch()
            const scanner = new BarcodeScanner({
                license: licenseKey,
                scanMode: EnumScanMode ? EnumScanMode.SM_MULTI_UNIQUE : "multi-unique", // Fallback to string if enum missing
                onUniqueBarcodeScanned: (result) => {
                    handleScan(result.text);
                },
                onError: (err) => {
                    console.error("Internal Scanner Error:", err);
                    onError?.(err.message);
                }
            });

            // Store instance before launch
            scannerRef.current = scanner;

            // Launch the UI
            await scanner.launch();
            setIsReady(true);

        } catch (err) {
            console.error('Scanner init error:', err);
            onError?.(err.message || 'Erreur initialisation scanner');
        }
    }, [onScan, onError, handleScan]);

    const handleScan = useCallback((txt) => {
        onScan?.(txt);
        setLastScanned(txt);
        playBeep();
        if (navigator.vibrate) navigator.vibrate(100);
        setTimeout(() => setLastScanned(null), 2000);
    }, [onScan]); // Dependencies for handleScan

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
