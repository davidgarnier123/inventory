import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [status, setStatus] = useState('loading'); // 'loading', 'ready', 'error', 'stopped'
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
                let checkAttempts = 0;
                while (checkAttempts < 50 && !window.Dynamsoft && isMounted) {
                    await new Promise(r => setTimeout(r, 100));
                    checkAttempts++;
                }

                if (!isMounted) {
                    isInitializing.current = false;
                    return;
                }
                
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
                    onUniqueBarcodeScanned: (result) => {
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                const scanner = await new BarcodeScannerClass(config);
                scannerRef.current = scanner;
                
                await scanner.launch();
                
                if (isMounted) {
                    setStatus('ready');
                } else {
                    scanner.dispose();
                }
            } catch (err) {
                console.error("Init Error:", err);
                if (isMounted) {
                    setStatus('error');
                    setErrorMessage(err.message || err.toString());
                }
            } finally {
                isInitializing.current = false;
            }
        };

        const timer = setTimeout(init, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            const disposeScanner = async () => {
                if (scannerRef.current) {
                    const s = scannerRef.current;
                    scannerRef.current = null;
                    try {
                        await s.dispose();
                    } catch (e) { }
                }
            };
            disposeScanner();
        };
    }, []);

    useEffect(() => {
        let isTransitioning = false;
        const toggleCamera = async () => {
            if (!scannerRef.current || status !== 'ready' || isTransitioning) return;
            isTransitioning = true;
            try {
                if (isActive) {
                    if (scannerRef.current.start) await scannerRef.current.start();
                    else if (scannerRef.current.open) await scannerRef.current.open();
                } else {
                    if (scannerRef.current.stop) await scannerRef.current.stop();
                    else if (scannerRef.current.close) await scannerRef.current.close();
                }
            } catch (err) {
                console.warn("[Scanner] Toggle warning:", err);
            } finally {
                isTransitioning = false;
            }
        };
        toggleCamera();
    }, [isActive, status]);

    return (
        <div className="barcode-scanner-outer" style={{ width: '100%', height: '50vh', minHeight: '300px', position: 'relative', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {status === 'ready' && (
                <div className="scanner-controls" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 11 }}>
                    <button
                        onClick={async () => {
                            if (scannerRef.current) {
                                try {
                                    if (scannerRef.current.turnOnFlash) await scannerRef.current.turnOnFlash();
                                    else if (scannerRef.current.turnOnTorch) await scannerRef.current.turnOnTorch();
                                } catch (e) {
                                    try { 
                                        if (scannerRef.current.turnOffFlash) await scannerRef.current.turnOffFlash();
                                        else if (scannerRef.current.turnOffTorch) await scannerRef.current.turnOffTorch();
                                    } catch (err) { }
                                }
                            }
                        }}
                        style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: 'white', cursor: 'pointer' }}
                    >⚡</button>
                    <button
                        onClick={async () => {
                            if (scannerRef.current) {
                                try {
                                    if (scannerRef.current.stop) await scannerRef.current.stop();
                                    else if (scannerRef.current.close) await scannerRef.current.close();
                                    setStatus('stopped');
                                } catch (e) { setStatus('stopped'); }
                            }
                        }}
                        style={{ background: 'rgba(255,0,0,0.3)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,0,0,0.5)', borderRadius: '50%', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: 'white', cursor: 'pointer' }}
                    >🛑</button>
                </div>
            )}

            {status === 'stopped' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10, background: 'rgba(0,0,0,0.8)' }}>
                    <p>Caméra arrêtée</p>
                    <button
                        onClick={async () => {
                            if (scannerRef.current) {
                                try {
                                    if (scannerRef.current.start) await scannerRef.current.start();
                                    else if (scannerRef.current.open) await scannerRef.current.open();
                                    setStatus('ready');
                                } catch (e) { window.location.reload(); }
                            } else window.location.reload();
                        }}
                        style={{ marginTop: '10px', padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >Redémarrer</button>
                </div>
            )}

            {status === 'error' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff4444', padding: '20px', textAlign: 'center', zIndex: 10, background: 'rgba(0,0,0,0.8)' }}>
                    <span style={{ fontSize: '2rem' }}>⚠️</span>
                    <p>{errorMessage}</p>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '10px', padding: '8px 16px', background: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Réessayer</button>
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
