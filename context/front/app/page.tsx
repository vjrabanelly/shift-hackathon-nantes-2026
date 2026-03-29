import Link from "next/link";

export default function Home() {
    return (
        <main className="blindspot-video-page">
            <video
                autoPlay
                muted
                loop
                playsInline
                className="blindspot-video"
                src="/video-accueil-v02.mp4"
            />
            <div className="blindspot-video-mask" />

            <div className="blindspot-page-content">
                <div className="blindspot-home-grid lg:grid-cols-[1.2fr_0.8fr]">
                    <section className="flex min-h-[70vh] flex-col justify-center gap-6">
                        <span className="blindspot-chip">
                            PWA Android via partage natif
                        </span>
                        <h1 className="blindspot-title">
                            Installe BlindSpot, puis partage du contenu pour y découvrir les angles morts.
                        </h1>
                        <p className="blindspot-lead">
                            BlindSpot n&apos;est pas une app qu&apos;on ouvre pour
                            chercher de l&apos;info. Elle s&apos;active au moment
                            ou tu tombes sur un article ou un contenu
                            qui mérite plus de contexte.
                        </p>
                        <div className="blindspot-actions">
                            <Link
                                href="/search"
                                className="blindspot-button blindspot-button-primary">
                                Tester avec une URL
                            </Link>
                            <a
                                href="#installation"
                                className="blindspot-button blindspot-button-secondary md:hidden">
                                Voir l&apos;installation
                            </a>
                        </div>
                    </section>

                    <aside
                        id="installation"
                        className="blindspot-glass-panel blindspot-step-card self-center">
                        <div className="mb-6 space-y-2">
                            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-black/55">
                                Comment ca marche
                            </p>
                        </div>

                        <div className="blindspot-step-list">
                            <div className="blindspot-glass-panel blindspot-step-card">
                                <span className="blindspot-step-index">01</span>
                                <h3 className="mt-4 text-lg font-semibold text-black">
                                    Installer la web app
                                </h3>
                                <p className="mt-2 text-sm leading-7 text-black/70">
                                    Depuis Android, ouvre BlindSpot dans le
                                    navigateur puis choisis &quot;Installer sur
                                    l&apos;ecran d&apos;accueil&quot;.
                                </p>
                            </div>
                            <div className="blindspot-glass-panel blindspot-step-card">
                                <span className="blindspot-step-index">02</span>
                                <h3 className="mt-4 text-lg font-semibold text-black">
                                    Partager un contenu
                                </h3>
                                <p className="mt-2 text-sm leading-7 text-black/70">
                                    Depuis un article, une app média, Google News ou
                                    un lien recu, utilise la feuille de partage
                                    et choisis BlindSpot.
                                </p>
                            </div>
                            <div className="blindspot-glass-panel blindspot-step-card">
                                <span className="blindspot-step-index">03</span>
                                <h3 className="mt-4 text-lg font-semibold text-black">
                                    Lire les 7 couches d&apos;analyse
                                </h3>
                                <p className="mt-2 text-sm leading-7 text-black/70">
                                    En quelques secondes tu récupères une synthese avec : les biais
                                    détectés, les angles manquants, les infos média et des références externes si tu souhaite aller plus loin.
                                </p>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    );
}
