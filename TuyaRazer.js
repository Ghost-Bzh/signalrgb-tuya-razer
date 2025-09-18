import TuyaBroadcast from './TuyaBroadcast.test.js';
import TuyaController from './TuyaController.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import TuyaNegotiator from './TuyaNegotiator.test.js';
import TuyaVirtualDevice from './TuyaVirtualDevice.test.js';

/* ---------- */
/*   DEVICE   */
/* ---------- */
export function Name() { return "Tuya Razer"; }
export function Version() { return "0.0.2"; }
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
        {"property":"shutDownColor", "group":"settings", "label":"Shutdown Color", "min":"0", "max":"360", "type":"color", "default":"#8000FF"}
	];
}

// Variables globales pour la gestion d'état
let lastRenderTime = 0;
let isInitialized = false;

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
            
            // Créer l'instance dans le controller
            controller.tuyaVirtualDevice = new TuyaVirtualDevice(controller.tuyaDevice);
            
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

export function Update()
{
    // Mise à jour optionnelle si nécessaire
    // Pourrait être utilisé pour vérifier l'état de la connexion
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
            controller.tuyaVirtualDevice.render(mode, color, delay, now);
            lastRenderTime = now;
        }
    } catch (error) {
        console.error("Error in Render function:", error);
    }
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
                    controller.tuyaVirtualDevice.render("Forced", shutDownColor, 0, Date.now());
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
