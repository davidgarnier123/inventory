import { useEffect, useRef, useState, useCallback } from 'react';
import './BarcodeScanner.css';

export default function BarcodeScanner({ onScan, onError, isActive = true }) {
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [lastScanned, setLastScanned] = useState(null);

    const initScanner = useCallback(async () => {
        try {
            // Import Dynamsoft bundle script via CDN or local package
            // The user provided the bundle approach
            const Dynamsoft = window.Dynamsoft;

            if (!Dynamsoft) {
                // If not loaded globally, try to import
                await import('https://cdn.jsdelivr.net/npm/dynamsoft-barcode-reader-bundle@11.2.4000/dist/dbr.bundle.js');
            }

            // High-level API initialization
            const scanner = new window.Dynamsoft.BarcodeScanner({
                license: "DLS2eyJoYW5kc2hha2VDb2RlIjoiMjAwMDAxLTE2NDk3MTAxOTIyNjQiLCJvcmdhbml6YXRpb25JRCI6IjIwMDAwMSIsInNlc3Npb25QYXNzd29yZCI6InRlc3RAdGVzdCIsImNoZWNrU2F2ZWRUcmFja2luZyI6ZmFsc2UsInByb2R1Y3RzIjpbIkRCUiIsIkRMU1AiLCJEVlIiLCJEVlIiLCJEM1BEIl0sImV4cGlyeSI6MTY0OTcxMDE5MjI2NH0=",
                scanMode: window.Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE, // Keep continuous scanning but unique
                onUniqueBarcodeScanned: (result) => {
                    const code = result.text;
                    onScan?.(code);

                    // Simple local feedback
                    setLastScanned(code);
                    playBeep();
                    if (navigator.vibrate) {
                        navigator.vibrate(100);
                    }
                    setTimeout(() => setLastScanned(null), 2000);
                }
            });

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
            scannerRef.current.launch().catch(err => {
                console.error('Launch error:', err);
                onError?.(err.message);
            });
        } else {
            // If the high-level API doesn't have a direct 'stop', 
            // the dispose in the cleanup should handle it if unmounted,
            // or we might need to hide it.
            // The 'launch' creates a UI.
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
