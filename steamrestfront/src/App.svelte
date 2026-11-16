<script lang="ts">
  import { Router, Link, Route } from 'svelte-routing';
  import Magasin from './lib/Magasin.svelte';
  import Bibliotheque from './lib/Bibliotheque.svelte';
  import Compte from './lib/Compte.svelte';
  import NotFound from './lib/NotFound.svelte';
  import { fermerSession, lireSession } from './lib/auth';
  import { navigate } from 'svelte-routing';

  export let url = '';
  let session = lireSession();

  function deconnecter() {
    fermerSession();
    session = null;
    navigate('/compte');
  }
</script>


<Router {url} >

  <nav>
    <span id="logo">Steam</span>
    <span class="link"><Link to="/">MAGASIN</Link></span>
    <span class="link"><Link to="/bibliotheque">BIBLIOTHÈQUE</Link></span>
    {#if session}
      <span class="user">{session.utilisateur.nomUtilisateur}</span>
      <button class="session-button" on:click={deconnecter}>Déconnexion</button>
    {:else}
      <span class="link"><Link to="/compte">CONNEXION / INSCRIPTION</Link></span>
    {/if}
  </nav>

  <main>
    <Route path="/" > <Magasin /> </Route>
    <Route path="/bibliotheque"> <Bibliotheque /> </Route>
    <Route path="/compte"> <Compte /> </Route>
    <Route path="*"> <NotFound /> </Route>
  </main>

</Router>


<style>
  #logo {
    font-size: 2em;
    font-weight: bold;
    color: #ffffff;
    margin-inline: 3rem;
  }

  nav {
    display: flex;
    align-items: center;
    background-color: #282c34;
    gap: 2rem;
    padding: 1rem;
  }

  .link {
    font-weight: 600;
  }

  .user { margin-left: auto; }
  .session-button {
    width: auto;
    margin: 0;
    padding: .35rem .65rem;
    font-size: .85rem;
    line-height: 1.2;
    white-space: nowrap;
    border: 0;
    border-radius: 5px;
    cursor: pointer;
  }

</style>
