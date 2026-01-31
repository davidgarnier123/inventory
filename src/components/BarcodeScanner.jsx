import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [status, setStatus] = useState('loading'); // 'loading', 'ready', 'error', 'stopped'
    const [errorMessage, setErrorMessage] = useState('');
    const [initKey, setInitKey] = useState(0); // Used to force a full re-init

    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    // Cleanup helper
    const cleanupScanner = async () => {
        if (scannerRef.current) {
            const s = scannerRef.current;
            scannerRef.current = null;
            try {
                console.log("[Scanner] Full disposal...");
                await s.dispose();
            } catch (e) {
                console.warn("[Scanner] Dispose error:", e);
            }
        }
    };

    // Full Initialization Logic
    useEffect(() => {
        let isMounted = true;
        let scannerInstance = null;

        const init = async () => {
            // Respect the isActive prop from parent (e.g. if we are on List tab, don't init)
            if (!isActive) {
                setStatus('stopped');
                return;
            }

            setStatus('loading');
            try {
                // Wait for library
                let attempts = 0;
                while (attempts < 50 && !window.Dynamsoft && isMounted) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if (!isMounted) return;
                if (!window.Dynamsoft) throw new Error("Dynamsoft library not found.");

                const Dynamsoft = window.Dynamsoft;
                const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);
                
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
                    autoStartCapturing: true,
                    onUniqueBarcodeScanned: (result) => {
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                console.log("[Scanner] Creating new instance...");
                scannerInstance = new BarcodeScannerClass(config);
                scannerRef.current = scannerInstance;

                await scannerInstance.launch();
                
                if (isMounted) {
                    setStatus('ready');
                } else {
                    scannerInstance.dispose();
                }

            } catch (err) {
                console.error("[Scanner] Init failed:", err);
                if (isMounted) {
                    setStatus('error');
                    setErrorMessage(err.message || "Erreur d'initialisation");
                    if (onErrorRef.current) onErrorRef.current(err.message);
                }
            }
        };

        const timer = setTimeout(init, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            cleanupScanner();
        };
    }, [initKey, isActive]); // Re-runs on manual restart OR when isActive changes

    const handleManualStop = async () => {
        await cleanupScanner();
        setStatus('stopped');
    };

    const handleManualRestart = () => {
        setInitKey(prev => prev + 1);
    };

    return (
        <div className="barcode-scanner-outer" style={{ width: '100%', height: '50vh', minHeight: '350px', position: 'relative', background: '#000', borderRadius: '16px', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {status === 'loading' && isActive && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'white', zIndex: 10 }}>
                    <p>Démarrage du scanner...</p>
                </div>
            )}

            {status === 'stopped' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.9)', color: 'white', zIndex: 12, backdropFilter: 'blur(5px)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Scanner arrêté</p>
                    <button 
                        onClick={handleManualRestart}
                        style={{ padding: '12px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59,130,246,0.4)' }}
                    >
                        Relancer le scanner
                    </button>
                </div>
            )}

            {status === 'ready' && (
                <div style={{ position: 'absolute', bottom: '25px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 11 }}>
                    <button 
                        onClick={handleManualStop}
                        style={{ width: '64px', height: '64px', background: 'rgba(239, 68, 68, 0.3)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', color: 'white', fontSize: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                    >🛑</button>
                </div>
            )}

            {status === 'error' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.95)', color: '#ef4444', padding: '30px', textAlign: 'center', zIndex: 13 }}>
                    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</span>
                    <p style={{ marginBottom: '1.5rem' }}>{errorMessage}</p>
                    <button 
                        onClick={handleManualRestart}
                        style={{ padding: '10px 20px', background: 'white', color: 'black', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >Réessayer</button>
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
