import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [status, setStatus] = useState('loading'); // 'loading', 'ready', 'error'
    const [isManuallyStopped, setIsManuallyStopped] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    const isInitializing = useRef(false);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            if (isInitializing.current) return;
            isInitializing.current = true;
            try {
                // Wait for Dynamsoft library
                let checkAttempts = 0;
                while (checkAttempts < 50 && !window.Dynamsoft && isMounted) {
                    await new Promise(r => setTimeout(r, 100));
                    checkAttempts++;
                }

                if (!isMounted) return;
                if (!window.Dynamsoft) throw new Error("Dynamsoft non chargé");

                const Dynamsoft = window.Dynamsoft;
                const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);
                if (!BarcodeScannerClass) throw new Error("Classe BarcodeScanner introuvable");

                const license = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9";
                BarcodeScannerClass.license = license;

                const config = {
                    container: containerRef.current,
                    license: license,
                    scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,
                    barcodeFormats: [Dynamsoft.DBR?.EnumBarcodeFormat?.BF_CODE_128 || 0x400],
                    showPoweredByDynamsoft: false,
                    showResultView: false,
                    showUploadImageButton: false,
                    autoStartCapturing: isActive,
                    scannerViewConfig: {
                        showCloseButton: true,
                        showFlashButton: true,
                        cameraSwitchControl: "toggleFrontBack",
                    },
                    onUniqueBarcodeScanned: (result) => {
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                const scanner = new BarcodeScannerClass(config);
                scannerRef.current = scanner;
                
                // Use launch() as it was the only method working in initial stable version
                await scanner.launch();
                
                if (isMounted) {
                    setStatus('ready');
                } else {
                    scanner.dispose();
                }
            } catch (err) {
                console.error("Scanner Init Error:", err);
                if (isMounted) {
                    setStatus('error');
                    setErrorMessage(err.message || "Erreur caméra");
                }
            } finally {
                isInitializing.current = false;
            }
        };

        const timer = setTimeout(init, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                const s = scannerRef.current;
                scannerRef.current = null;
                s.dispose();
            }
        };
    }, []);

    // Handle Active/Inactive and Manual Stop/Start
    useEffect(() => {
        const toggle = async () => {
            if (!scannerRef.current || status !== 'ready') return;
            try {
                if (isActive && !isManuallyStopped) {
                    // Force start capturing
                    await scannerRef.current.start();
                } else {
                    // Force stop capturing
                    await scannerRef.current.stop();
                }
            } catch (err) {
                console.warn("Toggle camera error:", err);
            }
        };
        toggle();
    }, [isActive, isManuallyStopped, status]);

    return (
        <div className="barcode-scanner-outer" style={{ width: '100%', height: '50vh', minHeight: '350px', position: 'relative', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {isManuallyStopped && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', color: 'white', backdropFilter: 'blur(4px)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Scanner en pause</p>
                    <button 
                        onClick={() => setIsManuallyStopped(false)}
                        style={{ padding: '12px 24px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
                    >
                        Redémarrer le scanner
                    </button>
                </div>
            )}

            {status === 'ready' && !isManuallyStopped && (
                <div style={{ position: 'absolute', bottom: '25px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 11 }}>
                   <button 
                        onClick={() => setIsManuallyStopped(true)}
                        style={{ width: '60px', height: '60px', background: 'rgba(239, 68, 68, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: 'white', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Arrêter"
                    >🛑</button>
                </div>
            )}

            {status === 'error' && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 13, background: 'rgba(0,0,0,0.95)', color: '#ef4444', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', textAlign: 'center' }}>
                    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</span>
                    <p style={{ marginBottom: '1.5rem' }}>{errorMessage}</p>
                    <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Réessayer</button>
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
