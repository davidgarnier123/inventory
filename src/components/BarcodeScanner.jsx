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

    // Initialisation du scanner
    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            if (isInitializing.current) return;
            isInitializing.current = true;
            try {
                // Attente de la librairie Dynamsoft
                let checkAttempts = 0;
                while (checkAttempts < 50 && !window.Dynamsoft && isMounted) {
                    await new Promise(r => setTimeout(r, 100));
                    checkAttempts++;
                }

                if (!isMounted) return;
                if (!window.Dynamsoft) throw new Error("Librairie Dynamsoft non chargée");

                const Dynamsoft = window.Dynamsoft;
                const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);

                if (!BarcodeScannerClass) throw new Error("API BarcodeScanner introuvable");

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

                // Création de l'instance (plus moderne et stable)
                const scanner = await (BarcodeScannerClass.createInstance ? BarcodeScannerClass.createInstance(config) : new BarcodeScannerClass(config));
                
                if (!isMounted) {
                    scanner.dispose();
                    return;
                }

                scannerRef.current = scanner;
                
                // Si non créé avec autoStart ou si on veut forcer la config
                if (scanner.updateRuntimeSettings) {
                    await scanner.updateRuntimeSettings("balance");
                }

                // Lancement initial
                await scanner.show();
                
                if (isMounted) {
                    setStatus('ready');
                }
            } catch (err) {
                console.error("Scanner Init Error:", err);
                if (isMounted) {
                    setStatus('error');
                    setErrorMessage(err.message || "Erreur caméra");
                    if (onErrorRef.current) onErrorRef.current(err.message);
                }
            } finally {
                isInitializing.current = false;
            }
        };

        const timer = setTimeout(init, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            const cleanup = async () => {
                if (scannerRef.current) {
                    const s = scannerRef.current;
                    scannerRef.current = null;
                    try {
                        await s.dispose();
                    } catch (e) { }
                }
            };
            cleanup();
        };
    }, []);

    // Gestion de l'état ON/OFF (Pause et Reprise)
    useEffect(() => {
        let active = true;
        const toggle = async () => {
            if (!scannerRef.current || status !== 'ready') return;
            
            try {
                // On utilise open/close pour libérer réellement la caméra (batterie)
                if (isActive && !isManuallyStopped) {
                    console.log("[Scanner] Activation caméra...");
                    if (scannerRef.current.open) await scannerRef.current.open();
                    else await scannerRef.current.start();
                } else {
                    console.log("[Scanner] Désactivation caméra...");
                    if (scannerRef.current.close) await scannerRef.current.close();
                    else await scannerRef.current.stop();
                }
            } catch (err) {
                console.warn("[Scanner] Toggle warning:", err);
            }
        };

        toggle();
        return () => { active = false; };
    }, [isActive, isManuallyStopped, status]);

    return (
        <div className="barcode-scanner-outer" style={{ width: '100%', height: '50vh', minHeight: '350px', position: 'relative', background: '#000', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {/* Overlay d'extinction manuelle */}
            {isManuallyStopped && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 12, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '500' }}>Caméra en pause</p>
                    <button
                        onClick={() => setIsManuallyStopped(false)}
                        style={{ padding: '12px 24px', background: 'var(--accent, #007bff)', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 4px 12px rgba(0,123,255,0.3)' }}
                    >
                        Redémarrer la caméra
                    </button>
                </div>
            )}

            {/* Contrôles overlays quand actif */}
            {status === 'ready' && !isManuallyStopped && (
                <div style={{ position: 'absolute', bottom: '25px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '30px', zIndex: 11 }}>
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
                        style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', cursor: 'pointer', transition: 'transform 0.2s' }}
                    >⚡</button>
                    
                    <button
                        onClick={() => setIsManuallyStopped(true)}
                        style={{ background: 'rgba(255,59,48,0.2)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: 'white', cursor: 'pointer' }}
                    >🛑</button>
                </div>
            )}

            {/* Error state */}
            {status === 'error' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff4b4b', padding: '30px', textAlign: 'center', zIndex: 13, background: 'rgba(0,0,0,0.9)' }}>
                    <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</span>
                    <p style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>{errorMessage}</p>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{ padding: '10px 20px', background: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >Réessayer</button>
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
