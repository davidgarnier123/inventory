import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [status, setStatus] = useState('loading'); // 'loading', 'ready', 'error'
    const [errorMessage, setErrorMessage] = useState('');

    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            try {
                // 1. Attente de la librairie (chargée dans index.html)
                let checkAttempts = 0;
                while (checkAttempts < 50 && !window.Dynamsoft && isMounted) {
                    await new Promise(r => setTimeout(r, 100));
                    checkAttempts++;
                }

                if (!isMounted) return;
                if (!window.Dynamsoft) throw new Error("La librairie Dynamsoft n'est pas chargée.");

                const Dynamsoft = window.Dynamsoft;
                const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);

                if (!BarcodeScannerClass) throw new Error("Classe BarcodeScanner introuvable.");

                // 2. Attente du DOM
                let domAttempts = 0;
                while (domAttempts < 20 && isMounted) {
                    if (containerRef.current && containerRef.current.offsetHeight > 0) break;
                    await new Promise(r => setTimeout(r, 200));
                    domAttempts++;
                }

                if (!isMounted || !containerRef.current) return;

                // 3. Configuration (Exactement comme votre snippet)
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
                    scannerViewConfig: {
                        showCloseButton: true,
                        showFlashButton: true,
                        cameraSwitchControl: "toggleFrontBack",
                    },
                    onUniqueBarcodeScanned: (result) => {
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                // On recrée l'instance
                const scanner = new BarcodeScannerClass(config);
                scannerRef.current = scanner;

                // 4. Lancement
                console.log("[Scanner] Launching...");
                await scanner.launch();

                if (isMounted) {
                    setStatus('ready');
                    console.log("[Scanner] Active and ready.");
                }

            } catch (err) {
                console.error("[Scanner] Error during init:", err);
                if (isMounted) {
                    setStatus('error');
                    setErrorMessage(err.message || err.toString());
                    if (onErrorRef.current) onErrorRef.current(err.message || err.toString());
                }
            }
        };

        const timer = setTimeout(init, 500);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                console.log("[Scanner] Cleaning up...");
                scannerRef.current.dispose();
                scannerRef.current = null;
            }
        };
    }, []);

    // Gestion de l'affichage (isActive)
    useEffect(() => {
        if (scannerRef.current && status === 'ready') {
            if (isActive) {
                scannerRef.current.show().catch(() => { });
            } else {
                scannerRef.current.hide();
            }
        }
    }, [isActive, status]);

    return (
        <div
            className="barcode-scanner-outer"
            style={{
                width: '100%',
                height: '50vh',
                minHeight: '300px',
                position: 'relative',
                background: '#000',
                borderRadius: '12px',
                overflow: 'hidden'
            }}
        >
            {/* 
                CONTENEUR SCANNER : 
                Il doit être vide. Dynamsoft va injecter son propre <video> et ses overlays dedans.
                S'il y a déjà quelque chose dedans, ça peut causer un écran noir.
            */}
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
            />

            {/* Loader removed as requested */}

            {status === 'ready' && (
                <div className="scanner-controls" style={{ position: 'absolute', bottom: '20px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '20px', zIndex: 11 }}>
                    <button
                        onClick={() => {
                            if (scannerRef.current) {
                                const state = scannerRef.current.getHTML5Element().querySelector('.dce-btn-torch')?.classList.contains('dce-btn-torch-on');
                                scannerRef.current.turnOnFlash().catch(() => {
                                    // Fallback toggle
                                    try { scannerRef.current.turnOffFlash(); } catch (e) { }
                                });
                            }
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.2)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                        title="Flash"
                    >
                        ⚡
                    </button>
                    <button
                        onClick={() => {
                            if (scannerRef.current) {
                                scannerRef.current.stop();
                                setStatus('stopped');
                            }
                        }}
                        style={{
                            background: 'rgba(255,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,0,0,0.5)',
                            borderRadius: '50%',
                            width: '50px',
                            height: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                        title="Arrêter"
                    >
                        🛑
                    </button>
                </div>
            )}

            {status === 'stopped' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', zIndex: 10, background: 'rgba(0,0,0,0.8)' }}>
                    <p>Caméra arrêtée</p>
                    <button
                        onClick={() => {
                            if (scannerRef.current) {
                                scannerRef.current.start().then(() => setStatus('ready'));
                            } else {
                                window.location.reload();
                            }
                        }}
                        style={{ marginTop: '10px', padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Redémarrer
                    </button>
                </div>
            )}

            {status === 'error' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ff4444', padding: '20px', textAlign: 'center', zIndex: 10, background: 'rgba(0,0,0,0.8)' }}>
                    <span style={{ fontSize: '2rem' }}>⚠️</span>
                    <p>{errorMessage}</p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '10px', padding: '8px 16px', background: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Réessayer
                    </button>
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
