<script lang="ts">
    import { API_URL } from '../config';
    import type { Jeu } from '../model/Jeu';
    import { entetesAuthentifiees, lireSession } from './auth';

    let jeux: Jeu[] = [];
    let session = lireSession();
    let titre = '';
    let developpeur = '';
    let editeur = '';
    let dateSortie = '';
    let image = '';
    let prix = 0;
    let erreurCreation = '';

    fetch(`${API_URL}/jeux`)
        .then(response => response.json())
        .then(data => jeux = data)
        .catch(error => console.error('Erreur de chargement des jeux :', error));

    async function ajouterJeu(jeu: Jeu) {
        if (!session) {
            window.location.assign('/compte');
            return;
        }
        try {
            const response = await fetch(`${API_URL}/achats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...entetesAuthentifiees() },
                body: JSON.stringify({ jeuId: jeu.jeuId, utilisateurId: session.utilisateur.utilisateurId })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? 'Achat impossible');
            alert(`Jeu ${jeu.titre} ajouté à la bibliothèque de ${session.utilisateur.nomUtilisateur}`);
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Achat impossible');
        }
    }

    async function ajouterAuCatalogue() {
        erreurCreation = '';
        try {
            const response = await fetch(`${API_URL}/jeux`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...entetesAuthentifiees() },
                body: JSON.stringify({ titre, developpeur, editeur, dateSortie: dateSortie || null, image, prix })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error ?? 'Ajout impossible');
            jeux = [...jeux, data];
            titre = '';
            developpeur = '';
            editeur = '';
            dateSortie = '';
            image = '';
            prix = 0;
        } catch (error) {
            erreurCreation = error instanceof Error ? error.message : 'Ajout impossible';
        }
    }
</script>

<div class="page-title">Bienvenue dans le magasin Steam</div>
{#if session?.utilisateur.role === 'administrateur'}
    <form class="ajout-jeu" on:submit|preventDefault={ajouterAuCatalogue}>
        <h2>Ajouter un jeu au catalogue Steam</h2>
        <label>Titre<input bind:value={titre} required /></label>
        <label>Développeur<input bind:value={developpeur} required /></label>
        <label>Éditeur<input bind:value={editeur} required /></label>
        <label>Date de sortie<input type="date" bind:value={dateSortie} /></label>
        <label>URL de l'image<input type="url" bind:value={image} required /></label>
        <label>Prix (€)<input type="number" min="0" step="0.01" bind:value={prix} required /></label>
        {#if erreurCreation}<p class="erreur" role="alert">{erreurCreation}</p>{/if}
        <button type="submit">Ajouter au catalogue</button>
    </form>
{/if}
<div class="actions">
    {#if session}<div>Acheter pour {session.utilisateur.nomUtilisateur}</div>
    {:else}<a href="/compte">Connectez-vous pour acheter</a>{/if}
</div>
<div class="jeux">
    {#each jeux as jeu}
        <div class="jeu">
            <img src={jeu.image} alt={jeu.titre} />
            <div class="infos">
                <div class="top"><h4>{jeu.titre}</h4><h2>{jeu.prix} €</h2></div>
                {#if session}<button on:click={() => ajouterJeu(jeu)}>Acheter</button>{/if}
            </div>
        </div>
    {/each}
</div>

<style>
    .ajout-jeu { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: .8rem; margin: 1.5rem 2rem; padding: 1.5rem; background: #282c34; border-radius: .75rem; }
    .ajout-jeu h2, .erreur { grid-column: 1 / -1; }
    .ajout-jeu label { display: flex; flex-direction: column; gap: .35rem; }
    .ajout-jeu input { min-width: 0; padding: .55rem; border: 1px solid #515969; border-radius: 5px; background: #171a20; color: white; }
    .ajout-jeu button { grid-column: 1 / -1; width: auto; }
    .erreur { color: #ff9b9b; }
    .actions { display: flex; justify-content: center; align-items: center; padding-block: 2rem; margin-inline: 2rem; gap: 1rem; background-color: #282c34; border-radius: .75rem; }
    .jeux { display: flex; flex-wrap: wrap; justify-content: center; margin: 2rem; gap: 2rem; }
    .jeu { display: flex; border-radius: .75rem; text-align: center; width: 25%; background-color: #282c34; color: rgba(255, 255, 255, .87); box-shadow: 0 8px 16px rgba(0, 0, 0, 1); }
    .infos { display: flex; flex-direction: column; width: 100%; align-items: center; }
    .jeu img { width: 75%; height: auto; border-radius: 5px; }
    .top { height: 100%; padding: 1rem; }
    button { background-color: #515969; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 75%; margin-bottom: 1rem; box-shadow: 0 4px 8px rgba(0, 0, 0, .33); }
</style>
