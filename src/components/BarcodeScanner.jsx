import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);

    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    useEffect(() => {
        let isMounted = true;
        let scanner = null;

        const init = async () => {
            // Attente que le script chargé dans index.html soit prêt
            let checkAttempts = 0;
            while (checkAttempts < 20 && !window.Dynamsoft) {
                await new Promise(r => setTimeout(r, 100));
                checkAttempts++;
            }

            if (!isMounted || !window.Dynamsoft) {
                if (isMounted && !window.Dynamsoft) {
                    onErrorRef.current?.("La librairie Dynamsoft n'a pas pu être chargée via le CDN.");
                }
                return;
            }

            const Dynamsoft = window.Dynamsoft;
            const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);

            if (!BarcodeScannerClass) {
                onErrorRef.current?.("La classe BarcodeScanner est introuvable.");
                return;
            }

            // Attente que le conteneur soit prêt et visible
            let domAttempts = 0;
            while (domAttempts < 20 && isMounted) {
                if (containerRef.current && containerRef.current.offsetHeight > 0) break;
                await new Promise(r => setTimeout(r, 200));
                domAttempts++;
            }

            if (!isMounted || !containerRef.current) return;

            try {
                // Demande explicite de l'accès caméra pour éviter l'écran blanc sur mobile
                try {
                    console.log("[Scanner] Demande d'accès caméra...");
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    stream.getTracks().forEach(track => track.stop()); // On coupe le flux de test
                } catch (camErr) {
                    console.error("[Scanner] Accès caméra refusé:", camErr);
                    if (isMounted && onErrorRef.current) {
                        onErrorRef.current("Accès caméra refusé. Veuillez autoriser la caméra dans les réglages.");
                    }
                    return;
                }

                const license = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9";

                // On applique la licence à la fois sur le Scanner et le moteur (Reader)
                BarcodeScannerClass.license = license;
                if (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeReader) {
                    Dynamsoft.DBR.BarcodeReader.license = license;
                }

                const config = {
                    container: containerRef.current,
                    license: license,
                    scanMode: Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE,
                    barcodeFormats: [window.Dynamsoft.DBR?.EnumBarcodeFormat?.BF_CODE_128 || 0x400],
                    showPoweredByDynamsoft: false,
                    showResultView: false,
                    showUploadImageButton: false,
                    autoStartCapturing: true,
                    scannerViewConfig: {
                        showCloseButton: false,
                        showFlashButton: true,
                    },
                    onUniqueBarcodeScanned: (result) => {
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                // On utilise le constructeur simple comme dans votre projet fonctionnel
                scanner = new BarcodeScannerClass(config);
                scannerRef.current = scanner;

                if (!isMounted) {
                    scanner.dispose();
                    return;
                }

                await scanner.launch();

                if (isMounted) setIsReady(true);

            } catch (err) {
                console.error("[Dynamsoft] Init error:", err);
                if (isMounted && onErrorRef.current) {
                    onErrorRef.current(err.message || err.toString());
                }
            }
        };

        init();

        return () => {
            isMounted = false;
            if (scanner && scanner.dispose) {
                scanner.dispose();
            }
        };
    }, []);

    useEffect(() => {
        if (scannerRef.current && isReady) {
            if (isActive) {
                scannerRef.current.show().catch(() => { });
            } else {
                scannerRef.current.hide();
            }
        }
    }, [isActive, isReady]);

    return (
        <div
            ref={containerRef}
            className="dynamsoft-scanner-container"
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
            {/* Injection point for Dynamsoft UI */}
            <div className="dce-video-container" style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
};

export default BarcodeScanner;
