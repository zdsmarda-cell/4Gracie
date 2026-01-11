
import ReactGA from 'react-ga4';

const MEASUREMENT_ID = 'G-DYR9GRYK85';
let isInitialized = false;

export const initGA = () => {
    if (!isInitialized) {
        ReactGA.initialize(MEASUREMENT_ID);
        isInitialized = true;
        // console.log('GA4 Initialized');
    }
};

export const logPageView = (path: string) => {
    if (isInitialized) {
        ReactGA.send({ hitType: "pageview", page: path });
    }
};

export const logEvent = (category: string, action: string, label?: string) => {
    if (isInitialized) {
        ReactGA.event({ category, action, label });
    }
};
