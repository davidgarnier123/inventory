import React, { useEffect, useRef, useState } from 'react';

const BarcodeScanner = ({ onScan, onError, isActive = true }) => {
    const containerRef = useRef(null);
    const scannerRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    const [needsGesture, setNeedsGesture] = useState(false);
    const [secureContextError, setSecureContextError] = useState(false);

    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const onErrorRef = useRef(onError);
    useEffect(() => { onErrorRef.current = onError; }, [onError]);

    useEffect(() => {
        // Détection du contexte sécurisé (nécessaire pour la caméra sur mobile)
        if (!window.isSecureContext && window.location.hostname !== 'localhost') {
            setSecureContextError(true);
            return;
        }
    }, []);

    const initScanner = async () => {
        let isMounted = true;
        let scanner = null;

        try {
            // 1. Attente de la librairie
            let checkAttempts = 0;
            while (checkAttempts < 30 && !window.Dynamsoft) {
                await new Promise(r => setTimeout(r, 100));
                checkAttempts++;
            }

            if (!window.Dynamsoft) {
                throw new Error("La librairie Dynamsoft n'a pas pu être chargée.");
            }

            const Dynamsoft = window.Dynamsoft;
            const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);

            // 2. Demande de caméra (User Gesture)
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });
                stream.getTracks().forEach(track => track.stop());
                setNeedsGesture(false);
            } catch (err) {
                console.warn("[Scanner] Gesture required or Permission denied", err);
                setNeedsGesture(true);
                return;
            }

            // 3. Configuration
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

            scanner = new BarcodeScannerClass(config);
            scannerRef.current = scanner;
            await scanner.launch();
            setIsReady(true);

        } catch (err) {
            console.error("[Dynamsoft] Init error:", err);
            if (onErrorRef.current) onErrorRef.current(err.message || err.toString());
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (!secureContextError) initScanner();
        }, 400);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.dispose();
                scannerRef.current = null;
            }
        };
    }, [secureContextError]);

    useEffect(() => {
        if (scannerRef.current && isReady) {
            if (isActive) {
                scannerRef.current.show().catch(() => { });
            } else {
                scannerRef.current.hide();
            }
        }
    }, [isActive, isReady]);

    if (secureContextError) {
        return (
            <div style={{ padding: '20px', background: '#321', color: '#ffb', borderRadius: '8px', border: '1px solid #f90', textAlign: 'center' }}>
                <h3>⚠️ Connexion non sécurisée</h3>
                <p>La caméra est bloquée car vous n'utilisez pas HTTPS. Sur mobile, l'accès à la caméra est interdit sur les sites non sécurisés.</p>
                <p style={{ fontSize: '0.8rem' }}>URL actuelle : {window.location.protocol}//{window.location.hostname}</p>
            </div>
        );
    }

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
            <div className="dce-video-container" style={{ width: '100%', height: '100%' }}></div>

            {needsGesture && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
                    <button
                        onClick={initScanner}
                        style={{ padding: '12px 24px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}
                    >
                        📷 Activer la caméra
                    </button>
                </div>
            )}

            {!isReady && !needsGesture && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                    Chargement...
                </div>
            )}
        </div>
    );
};

export default BarcodeScanner;
