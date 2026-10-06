$('search').oninput=()=>{clearTimeout(searchTimeout);searchTimeout=setTimeout(()=>rebuildPool(false),140);};
$('search-clear').onclick=()=>{clearTimeout(searchTimeout);$('search').value='';rebuildPool(false);$('search').focus();};
$('search-scope').onchange=()=>rebuildPool(false);
$('group-filter').onchange=()=>{chapter=0;updateDocumentOptions();activeSidebar();rebuildPool(false);};
$('document-filter').onchange=()=>{chapter=+$('document-filter').value;activeSidebar();rebuildPool(false);};
$('status-filter').onchange=()=>rebuildPool(false);
$('set-filter').onchange=()=>rebuildPool(false);
$('clear-filters').onclick=()=>clearFilters();
