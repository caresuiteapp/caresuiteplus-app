import { links } from './site-links';

const appScreens = [
  {
    src: '/landingpage/media/caresuite-assist-employee-home.png',
    role: 'Mitarbeitende',
    alt: 'Originalansicht der CareSuite Assist App für Mitarbeitende aus dem Google Play Store',
    className: 'assist-app-screen employee',
  },
  {
    src: '/landingpage/media/caresuite-assist-client-home.png',
    role: 'Klient:innen',
    alt: 'Originalansicht der CareSuite Assist App für Klientinnen und Klienten aus dem Google Play Store',
    className: 'assist-app-screen client',
  },
];

export default function AppStoreShowcase() {
  return (
    <section className="assist-app section-anchor" id="android-app" aria-labelledby="assist-app-heading">
      <div className="assist-app-layout wrap">
        <div className="assist-app-copy">
          <div className="assist-app-identity">
            <img
              src="/landingpage/media/caresuite-assist-icon.webp"
              alt=""
              width="256"
              height="256"
              loading="lazy"
              decoding="async"
            />
            <div>
              <span className="assist-app-name">CareSuite Assist</span>
              <span className="assist-app-availability"><i aria-hidden="true" /> Jetzt auf Google Play</span>
            </div>
          </div>
          <h2 id="assist-app-heading">Dein HealthOS.<br /><em>Jetzt als App.</em></h2>
          <p>Für Mitarbeitende und Klient:innen.<br />Im Alltag dabei.</p>
          <a
            className="assist-app-store-link"
            href={links.playStore}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="CareSuite Assist bei Google Play herunterladen, öffnet in einem neuen Tab"
          >
            <img
              src="/landingpage/media/google-play-badge-de.png"
              alt="Jetzt bei Google Play"
              width="646"
              height="250"
              loading="lazy"
              decoding="async"
            />
          </a>
        </div>
        <div className="assist-app-screens" aria-label="Originalansichten der Android-App">
          <div className="assist-app-scenery" aria-hidden="true">
            <span className="assist-app-orbit" />
            <span className="assist-app-orbit assist-app-orbit-secondary" />
            <span className="assist-app-floor" />
          </div>
          {appScreens.map(screen => (
            <figure className={screen.className} key={screen.role}>
              <div className="assist-app-image-shell">
                <span className="assist-app-device-key volume" aria-hidden="true" />
                <span className="assist-app-device-key power" aria-hidden="true" />
                <div className="assist-app-device-display">
                  <img
                    src={screen.src}
                    alt={screen.alt}
                    width="1080"
                    height="1920"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>
              <figcaption><i aria-hidden="true" />{screen.role}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
