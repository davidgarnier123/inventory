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
            // Wait for CDN library to be available
            let checkAttempts = 0;
            while (checkAttempts < 30 && !window.Dynamsoft) {
                await new Promise(r => setTimeout(r, 100));
                checkAttempts++;
            }

            if (!isMounted) return;
            if (!window.Dynamsoft) {
                onErrorRef.current?.("La librairie Dynamsoft n'a pas pu être chargée.");
                return;
            }

            const Dynamsoft = window.Dynamsoft;
            const BarcodeScannerClass = Dynamsoft.BarcodeScanner || (Dynamsoft.DBR && Dynamsoft.DBR.BarcodeScanner);

            if (!BarcodeScannerClass) {
                onErrorRef.current?.("La classe BarcodeScanner est introuvable.");
                return;
            }

            // Wait for container Ref
            let domAttempts = 0;
            while (domAttempts < 20 && isMounted) {
                if (containerRef.current && containerRef.current.offsetHeight > 0) break;
                await new Promise(r => setTimeout(r, 200));
                domAttempts++;
            }

            if (!isMounted || !containerRef.current) return;

            try {
                const license = "DLS2eyJoYW5kc2hha2VDb2RlIjoiMTA1MDYwNTQxLU1UQTFNRFl3TlRReExYZGxZaTFVY21saGJGQnliMm8iLCJtYWluU2VydmVyVVJMIjoiaHR0cHM6Ly9tZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwib3JnYW5pemF0aW9uSUQiOiIxMDUwNjA1NDEiLCJzdGFuZGJ5U2VydmVyVVJMIjoiaHR0cHM6Ly9zZGxzLmR5bmFtc29mdG9ubGluZS5jb20vIiwiY2hlY2tDb2RlIjo1OTU1MDkyODN9";

                // Using constructor as in your working example
                BarcodeScannerClass.license = license;

                const config = {
                    container: containerRef.current,
                    license: license,
                    scanMode: Dynamsoft.EnumScanMode ? Dynamsoft.EnumScanMode.SM_MULTI_UNIQUE : 2,
                    barcodeFormats: [window.Dynamsoft.DBR?.EnumBarcodeFormat?.BF_CODE_128 || 0x400],
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
                        console.log("[Dynamsoft] Scanned:", result.text);
                        if (onScanRef.current) onScanRef.current(result.text, result);
                    }
                };

                // MATCHING YOUR WORKING SNIPPET: new BarcodeScanner(config)
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

        // Delay to avoid strict mode race
        const timer = setTimeout(init, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scanner) {
                console.log("[Dynamsoft] Disposing...");
                scanner.dispose();
            }
        };
    }, []);

    useEffect(() => {
        if (scannerRef.current && isReady) {
            try {
                if (isActive) {
                    scannerRef.current.show().catch(() => { });
                } else {
                    scannerRef.current.hide();
                }
            } catch (e) { }
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
            <div className="dce-video-container" style={{ width: '100%', height: '100%' }}></div>
        </div>
    );
};

export default BarcodeScanner;
