<script lang="ts">
    import { API_URL } from '../config';
    import { enregistrerSession, lireSession } from './auth';

    let mode: 'connexion' | 'inscription' = 'connexion';
    let nomUtilisateur = '';
    let email = '';
    let motDePasse = '';
    let erreur = '';
    let enCours = false;
    $: dejaConnecte = lireSession();

    async function lireReponse(response: Response) {
        const type = response.headers.get('content-type') ?? '';
        if (!type.includes('application/json')) {
            throw new Error(`Le serveur API a répondu en HTML (HTTP ${response.status}). Redémarrez le backend puis réessayez.`);
        }
        return response.json();
    }

    async function soumettre() {
        erreur = '';
        enCours = true;
        try {
            if (mode === 'inscription') {
                const reponseInscription = await fetch(`${API_URL}/utilisateurs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nomUtilisateur, email, motDePasse })
                });
                const resultatInscription = await lireReponse(reponseInscription);
                if (!reponseInscription.ok) throw new Error(resultatInscription.error ?? 'Inscription impossible');
            }

            const reponseConnexion = await fetch(`${API_URL}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiant: mode === 'inscription' ? nomUtilisateur : nomUtilisateur || email, motDePasse })
            });
            const resultatConnexion = await lireReponse(reponseConnexion);
            if (!reponseConnexion.ok) throw new Error(resultatConnexion.error ?? 'Connexion impossible');
            enregistrerSession({ token: resultatConnexion.token, utilisateur: resultatConnexion.utilisateur });
            window.location.assign('/');
        } catch (e) {
            erreur = e instanceof Error ? e.message : 'Une erreur est survenue';
        } finally {
            enCours = false;
        }
    }
</script>

<section class="compte">
    {#if dejaConnecte}
        <h1>Vous êtes connecté·e comme {dejaConnecte.utilisateur.nomUtilisateur}</h1>
        <p>Votre session est active dans cet onglet.</p>
        <a href="/">Retourner au magasin</a>
    {:else}
        <h1>{mode === 'connexion' ? 'Connexion' : 'Créer un compte'}</h1>
        <div class="choix-mode">
            <button class:actif={mode === 'connexion'} type="button" on:click={() => mode = 'connexion'}>Connexion</button>
            <button class:actif={mode === 'inscription'} type="button" on:click={() => mode = 'inscription'}>Inscription</button>
        </div>
        <form on:submit|preventDefault={soumettre}>
            {#if mode === 'inscription'}
                <label>Nom d'utilisateur<input bind:value={nomUtilisateur} autocomplete="username" required /></label>
                <label>Email<input type="email" bind:value={email} autocomplete="email" required /></label>
            {:else}
                <label>Nom d'utilisateur ou email<input bind:value={nomUtilisateur} autocomplete="username" required /></label>
            {/if}
            <label>Mot de passe<input type="password" bind:value={motDePasse} minlength="8" autocomplete={mode === 'inscription' ? 'new-password' : 'current-password'} required /></label>
            {#if erreur}<p class="erreur" role="alert">{erreur}</p>{/if}
            <button class="valider" type="submit" disabled={enCours}>{enCours ? 'Patientez…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}</button>
        </form>
    {/if}
</section>

<style>
    .compte { max-width: 440px; margin: 3rem auto; padding: 2rem; background: #282c34; border-radius: 12px; }
    h1 { margin-top: 0; text-align: center; }
    .choix-mode { display: flex; gap: .75rem; margin-bottom: 1.5rem; }
    button, input { font: inherit; }
    .choix-mode button, .valider { padding: .75rem 1rem; border: 0; border-radius: 6px; cursor: pointer; }
    .choix-mode button { flex: 1; background: #414854; color: white; }
    .choix-mode button.actif, .valider { background: #1b75d0; color: white; }
    form, label { display: flex; flex-direction: column; gap: .5rem; }
    form { gap: 1rem; }
    input { padding: .7rem; border-radius: 5px; border: 1px solid #737b88; background: #171a20; color: white; }
    .erreur { color: #ff9b9b; margin: 0; }
    a { color: #9acaff; }
</style>
