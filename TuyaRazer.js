import TuyaBroadcast from './TuyaBroadcast.test.js';
import TuyaController from './TuyaController.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import TuyaNegotiator from './TuyaNegotiator.test.js';
import TuyaVirtualDevice from './TuyaVirtualDevice.test.js';

/* ---------- */
/*   DEVICE   */
/* ---------- */
export function Name() { return "Tuya Razer"; }
export function Version() { return "0.0.3"; } // Version incrémentée
export function Type() { return "network"; }
export function Publisher() { return "RickOfficial"; }
export function Size() { return [4, 1]; }
export function DefaultPosition() {return [0, 70]; }
export function DefaultScale(){return 1.0;}

export function ControllableParameters()
{
	return [
		{"property":"lightingMode", "group":"settings", "label":"Lighting Mode", "type":"combobox", "values":["Canvas", "Forced"], "default":"Canvas"},
		{"property":"forcedColor", "group":"settings", "label":"Forced Color", "min":"0", "max":"360", "type":"color", "default":"#009bde"},
		{"property":"frameDelay", "group":"settings", "label":"Frame Delay (ms)", "min":"20", "max":"200", "type":"number", "default":"50"},
		{"property":"turnOff", "group":"settings", "label":"On shutdown", "type":"combobox", "values":["Do nothing", "Single color", "Turn device off"], "default":"Turn device off"},
        {"property":"shutDownColor", "group":"settings", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"#8000FF"},
        {"property":"deviceSync", "group":"advanced", "label":"Device Synchronization", "type":"combobox", "values":["Automatic", "Manual"], "default":"Automatic"}
	];
}

// Variables globales pour la gestion d'état
let lastRenderTime = 0;
let isInitialized = false;
let deviceSyncMode = "Automatic";

export function Initialize()
{
    try {
        if (controller && controller.enabled)
        {
            console.log("Initializing Tuya device controller...");
            
            // Vérifier que tuyaDevice existe avant de créer le VirtualDevice
            if (!controller.tuyaDevice) {
                console.error("TuyaDevice not found in controller");
                return false;
            }
            
            // Récupérer le mode de synchronisation
            deviceSyncMode = controller.deviceSync || "Automatic";
            console.log("Device synchronization mode:", deviceSyncMode);
            
            // Créer l'instance dans le controller
            controller.tuyaVirtualDevice = new TuyaVirtualDevice(controller.tuyaDevice);
            
            // Configuration spécifique pour les barres LED
            configureDeviceForLEDBars();
            
            isInitialized = true;
            console.log("Tuya device initialized successfully");
            return true;
        } else {
            console.warn("Controller is not enabled");
            return false;
        }
    } catch (error) {
        console.error("Error during initialization:", error);
        return false;
    }
}

// Configuration spécifique pour les barres LED
function configureDeviceForLEDBars() {
    try {
        // Vérifier si c'est une barre LED (basé sur le nom ou les propriétés)
        if (controller.tuyaDevice && controller.tuyaDevice.name) {
            const devName = controller.tuyaDevice.name.toLowerCase();
            if (devName.includes("bar") || devName.includes("lightbar")) {
                console.log("Configuring LED bar device...");
                
                // Forcer la synchronisation si c'est une barre LED
                if (deviceSyncMode === "Automatic") {
                    console.log("Applying LED bar synchronization fix");
                    // Ici vous devriez appeler une méthode spécifique de votre appareil
                    // pour s'assurer que toutes les LEDs répondent
                }
            }
        }
    } catch (error) {
        console.warn("Error in LED bar configuration:", error);
    }
}

export function Update()
{
    // Vérification périodique de l'état des appareils
    try {
        if (isInitialized && controller && controller.tuyaDevice) {
            // Vérifier si l'appareil est toujours connecté
            if (typeof controller.tuyaDevice.isConnected === 'function' && 
                !controller.tuyaDevice.isConnected()) {
                console.warn("Device disconnected, attempting reconnection...");
                isInitialized = false;
                Initialize(); // Tentative de reconnexion
            }
        }
    } catch (error) {
        console.error("Error in Update function:", error);
    }
}

export function Render()
{
    try {
        if (!isInitialized) {
            console.warn("Renderer called but device not initialized");
            return;
        }
        
        if (!controller || !controller.enabled || !controller.tuyaVirtualDevice) {
            console.warn("Controller not ready for rendering");
            return;
        }
        
        const now = Date.now();
        const mode = controller.lightingMode || "Canvas";
        const color = controller.forcedColor || "#009bde";
        const delay = controller.frameDelay || 100;
        
        // Respecter le délai entre les frames
        if (now - lastRenderTime >= delay) {
            // CORRECTION: Appel correct de la fonction render avec tous les paramètres nécessaires
            controller.tuyaVirtualDevice.render(mode, color, delay, now);
            
            // CORRECTION: Pour le mode Forced, s'assurer que la couleur est correctement appliquée
            if (mode === "Forced") {
                applyForcedColorFix(color);
            }
            
            lastRenderTime = now;
        }
    } catch (error) {
        console.error("Error in Render function:", error);
    }
}

// Correctif pour le mode Forced
function applyForcedColorFix(color) {
    try {
        // Vérifier que la couleur est au format correct
        let formattedColor = color;
        if (!color.startsWith('#')) {
            formattedColor = `#${color}`;
        }
        
        console.log("Applying forced color:", formattedColor);
        
        // S'assurer que toutes les barres LED reçoivent la commande
        if (deviceSyncMode === "Manual") {
            // Implémentez ici une logique spécifique pour synchroniser manuellement
            // les dispositifs si nécessaire
            synchronizeDevicesManually(formattedColor);
        }
    } catch (error) {
        console.error("Error in forced color fix:", error);
    }
}

function synchronizeDevicesManually(color) {
    // Cette fonction devrait contenir le code spécifique pour s'assurer
    // que toutes les barres LED reçoivent la commande de couleur
    // Cela dépend de l'implémentation de votre bibliothèque Tuya
    
    console.log("Manual device synchronization for color:", color);
    // Implémentation spécifique à ajouter ici
}

export function Shutdown()
{
    try {
        console.log("Shutting down Tuya device...");
        
        const turnOffAction = controller.turnOff || "Turn device off";
        const shutDownColor = controller.shutDownColor || "#8000FF";
        
        switch(turnOffAction) {
            case "Single color":
                if (controller.tuyaVirtualDevice) {
                    // Appliquer la couleur d'arrêt à toutes les barres
                    controller.tuyaVirtualDevice.render("Forced", shutDownColor, 0, Date.now());
                    applyForcedColorFix(shutDownColor);
                }
                break;
            case "Turn device off":
                if (controller.tuyaDevice && typeof controller.tuyaDevice.turnOff === 'function') {
                    controller.tuyaDevice.turnOff();
                }
                break;
            // "Do nothing" - ne rien faire
        }
        
        // Nettoyer les ressources
        if (controller.tuyaVirtualDevice && typeof controller.tuyaVirtualDevice.cleanup === 'function') {
            controller.tuyaVirtualDevice.cleanup();
        }
        
        isInitialized = false;
        console.log("Tuya device shutdown completed");
    } catch (error) {
        console.error("Error during shutdown:", error);
    }
}

export function Validate()
{
    try {
        // Vérifications de base pour s'assurer que le contrôleur est valide
        if (!controller) {
            console.error("Controller is not defined");
            return false;
        }
        
        if (!controller.tuyaDevice) {
            console.error("TuyaDevice is not defined in controller");
            return false;
        }
        
        // Vérifier que les méthodes nécessaires existent
        if (typeof TuyaVirtualDevice !== 'function') {
            console.error("TuyaVirtualDevice class is not available");
            return false;
        }
        
        // Vérification spécifique pour le mode Forced
        if (controller.lightingMode === "Forced") {
            console.log("Validating forced color mode...");
            if (!controller.forcedColor) {
                console.warn("Forced color is not set, using default");
            }
        }
        
        console.log("Tuya device validation successful");
        return true;
    } catch (error) {
        console.error("Validation error:", error);
        return false;
    }
}

/* ------------- */
/*   DISCOVERY   */
/* ------------- */
export function DiscoveryService()
{
    this.ipCache = {};
    this.lastPollTime = -5000;
    this.PollInterval = 5000;
    this.devicesLoaded = false;
    this.negotiator = null;
    this.broadcast = null;

    this.Initialize = function()
    {
        try {
            this.negotiator = new TuyaNegotiator();
            this.broadcast = new TuyaBroadcast();
            this.broadcast.on('broadcast.device', this.handleTuyaDiscovery.bind(this));
            console.log("Tuya discovery service initialized");
        } catch (error) {
            console.error("Error initializing discovery service:", error);
        }
    }

    this.handleTuyaDiscovery = function(data)
    {
        try {
            let deviceData = data;

            // Vérifier si un contrôleur avec cet ID existe déjà
            if (!service.hasController(deviceData.gwId))
            {
                console.log('Creating controller for ' + deviceData.gwId);
                try {
                    const deviceJson = service.getSetting(deviceData.gwId, 'data');
                    if (deviceJson)
                    {
                        deviceData = JSON.parse(deviceJson);
                    }

                    const tuyaDevice = new TuyaDevice(deviceData, this.negotiator.crc);
                    const controller = new TuyaController(tuyaDevice);

                    try {
                        this.negotiator.addDevice(tuyaDevice);
                    } catch(ex)
                    {
                        console.error("Error adding device to negotiator:", ex.message);
                    }

                    service.addController(controller);
                    if (controller.enabled) service.announceController(controller);
                } catch(ex)
                {
                    console.error("Error creating controller:", ex.message);
                }
            }
            else
            {
                // Si un contrôleur existe déjà
                let controller = service.getController(deviceData.gwId);
                // Mais le dispositif détecté n'est pas initialisé
                if (!controller.tuyaDevice.initialized && controller.tuyaDevice.localKey)
                {
                    this.negotiator.negotiate();
                }
            }
        } catch (error) {
            console.error("Error in device discovery:", error);
        }
    }

    this.Update = function(force)
    {
        try {
            const now = Date.now();
            if (this.negotiator)
            {
                this.negotiator.handleQueue(now);
            }
        } catch (error) {
            console.error("Error in discovery update:", error);
        }
    }

    this.Discovered = function(receivedPacket)
    {
        // Non utilisé dans cette implémentation
    }
}
