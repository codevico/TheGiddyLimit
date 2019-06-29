"use strict";

const STR_REPRINTED = "reprinted";

window.onload = async function load () {
	await ExcludeUtil.pInitialise();
	SortUtil.initHandleFilterButtonClicks();
	DataUtil.deity.loadJSON().then(onJsonLoad);
};

let list;
const sourceFilter = getSourceFilter();
const pantheonFilter = new Filter({
	header: "Pantheon",
	items: [
		"Celtic",
		"Dawn War",
		"Dragonlance",
		"Drow",
		"Dwarven",
		"Eberron",
		"Egyptian",
		"Elven",
		"Faerûnian",
		"Forgotten Realms",
		"Gnomish",
		"Greek",
		"Greyhawk",
		"Halfling",
		"Nonhuman",
		"Norse",
		"Orc"
	]
});
const categoryFilter = new Filter({
	header: "Category",
	items: [
		STR_NONE,
		"Other Faiths of Eberron",
		"The Dark Six",
		"The Gods of Evil",
		"The Gods of Good",
		"The Gods of Neutrality",
		"The Sovereign Host"
	],
	itemSortFn: null
});

function unpackAlignment (g) {
	g.alignment.sort(SortUtil.alignmentSort);
	if (g.alignment.length === 2 && g.alignment.includes("N")) {
		const out = [...g.alignment];
		if (out[0] === "N") out[0] = "NX";
		else out[1] = "NY";
		return out;
	}
	return MiscUtil.copy(g.alignment);
}

let filterBox;
async function onJsonLoad (data) {
	list = ListUtil.search({
		valueNames: ["name", "pantheon", "alignment", "domains", "symbol", "source", "uniqueid"],
		listClass: "deities",
		sortFunction: SortUtil.listSort
	});

	const alignmentFilter = new Filter({
		header: "Alignment",
		items: ["L", "NX", "C", "G", "NY", "E", "N"],
		displayFn: Parser.alignmentAbvToFull,
		itemSortFn: null
	});
	const domainFilter = new Filter({
		header: "Domain",
		items: ["Arcana", "Death", "Forge", "Grave", "Knowledge", "Life", "Light", "Nature", STR_NONE, "Order", "Tempest", "Trickery", "War"]
	});
	const miscFilter = new Filter({
		header: "Miscellaneous",
		items: [STR_REPRINTED],
		displayFn: StrUtil.uppercaseFirst,
		deselFn: (it) => { return it === STR_REPRINTED }
	});

	filterBox = await pInitFilterBox({
		filters: [sourceFilter, alignmentFilter, pantheonFilter, categoryFilter, domainFilter, miscFilter]
	});

	const $outVisibleResults = $(`.lst__wrp-search-visible`);
	list.on("updated", () => {
		$outVisibleResults.html(`${list.visibleItems.length}/${list.items.length}`);
	});

	// filtering function
	$(filterBox).on(
		FilterBox.EVNT_VALCHANGE,
		handleFilterChange
	);

	const subList = ListUtil.initSublist({
		valueNames: ["name", "pantheon", "alignment", "domains", "id"],
		listClass: "subdeities",
		getSublistRow: getSublistItem
	});
	ListUtil.initGenericPinnable();

	addDeities(data);
	BrewUtil.pAddBrewData()
		.then(handleBrew)
		.then(() => BrewUtil.bind({list}))
		.then(() => BrewUtil.pAddLocalBrewData())
		.catch(BrewUtil.pPurgeBrew)
		.then(async () => {
			BrewUtil.makeBrewButton("manage-brew");
			BrewUtil.bind({filterBox, sourceFilter});
			await ListUtil.pLoadState();
			RollerUtil.addListRollButton();
			ListUtil.addListShowHide();

			History.init(true);
			ExcludeUtil.checkShowAllExcluded(deitiesList, $(`#pagecontent`));
		});
}

function handleBrew (homebrew) {
	addDeities(homebrew);
	return Promise.resolve();
}

let deitiesList = [];
let dtI = 0;
function addDeities (data) {
	if (!data.deity || !data.deity.length) return;

	deitiesList = deitiesList.concat(data.deity);

	let tempString = "";
	for (; dtI < deitiesList.length; dtI++) {
		const g = deitiesList[dtI];
		if (ExcludeUtil.isExcluded(g.name, "deity", g.source)) continue;

		g._fAlign = unpackAlignment(g);
		if (!g.category) g.category = STR_NONE;
		if (!g.domains) g.domains = [STR_NONE];
		g.domains.sort(SortUtil.ascSort);

		g._fReprinted = g.reprinted ? STR_REPRINTED : "";

		tempString += `
			<li class="row" ${FLTR_ID}="${dtI}" onclick="ListUtil.toggleSelected(event, this)" oncontextmenu="ListUtil.openContextMenu(event, this)">
				<a id="${dtI}" href="#${UrlUtil.autoEncodeHash(g)}" title="${g.name}">
					<span class="name col-3 pl-0">${g.name}</span>
					<span class="pantheon col-2 text-center">${g.pantheon}</span>
					<span class="alignment col-2 text-center">${g.alignment.join("")}</span>
					<span class="domains col-3 ${g.domains[0] === STR_NONE ? `list-entry-none` : ""}">${g.domains.join(", ")}</span>
					<span class="source col-2 text-center ${Parser.sourceJsonToColor(g.source)} pr-0" title="${Parser.sourceJsonToFull(g.source)}" ${BrewUtil.sourceJsonToStyle(g.source)}>${Parser.sourceJsonToAbv(g.source)}</span>
					
					<span class="uniqueid hidden">${g.uniqueId ? g.uniqueId : dtI}</span>
				</a>
			</li>
		`;

		sourceFilter.addItem(g.source);
		pantheonFilter.addItem(g.pantheon);
		categoryFilter.addItem(g.category);
	}
	const lastSearch = ListUtil.getSearchTermAndReset(list);
	$(`#deitiesList`).append(tempString);

	list.reIndex();
	if (lastSearch) list.search(lastSearch);
	list.sort("name");
	filterBox.render();
	handleFilterChange();

	ListUtil.setOptions({
		itemList: deitiesList,
		getSublistRow: getSublistItem,
		primaryLists: [list]
	});
	ListUtil.bindPinButton();
	Renderer.hover.bindPopoutButton(deitiesList);
	UrlUtil.bindLinkExportButton(filterBox);
	ListUtil.bindDownloadButton();
	ListUtil.bindUploadButton();
}

function handleFilterChange () {
	const f = filterBox.getValues();
	list.filter(function (item) {
		const g = deitiesList[$(item.elm).attr(FLTR_ID)];
		return filterBox.toDisplay(
			f,
			g.source,
			g._fAlign,
			g.pantheon,
			g.category,
			g.domains,
			g._fReprinted
		);
	});
	FilterBox.selectFirstVisible(deitiesList);
}

function getSublistItem (g, pinId) {
	return `
		<li class="row" ${FLTR_ID}="${pinId}" oncontextmenu="ListUtil.openSubContextMenu(event, this)">
			<a href="#${UrlUtil.autoEncodeHash(g)}" title="${g.name}">
				<span class="name col-4 pl-0">${g.name}</span>
				<span class="pantheon col-2">${g.pantheon}</span>
				<span class="alignment col-2">${g.alignment.join("")}</span>
				<span class="domains col-4 ${g.domains[0] === STR_NONE ? `list-entry-none` : ""} pr-0">${g.domains.join(", ")}</span>
				<span class="id hidden">${pinId}</span>
			</a>
		</li>
	`;
}

const renderer = Renderer.get();
function loadHash (jsonIndex) {
	renderer.setFirstSection(true);
	const deity = deitiesList[jsonIndex];

	function getDeityBody (deity, reprintIndex) {
		const renderStack = [];
		if (deity.entries) renderer.recursiveRender({entries: deity.entries}, renderStack);
		return `
		${reprintIndex ? `
			<tr><td colspan="6">
			<i class="text-muted">
			${reprintIndex === 1 ? `This deity is a reprint.` : ""} The version below was printed in an older publication (${Parser.sourceJsonToFull(deity.source)}${deity.page > 0 ? `, page ${deity.page}` : ""}).
			</i>
			</td></tr>
		` : ""}

		${Renderer.deity.getOrderedParts(deity, `<tr><td colspan="6">`, `</td></tr>`)}
		
		${deity.symbolImg ? `<tr><td colspan="6">${renderer.render({entries: [deity.symbolImg]})}</td></tr>` : ""}
		${renderStack.length ? `<tr class="text"><td colspan="6">${renderStack.join("")}</td></tr>` : ""}
		`;
	}

	const $content = $(`#pagecontent`).empty();
	$content.append(`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getNameTr(deity, {suffix: deity.title ? `, ${deity.title.toTitleCase()}` : ""})}
		${getDeityBody(deity)}
		${deity.reprinted ? `<tr class="text"><td colspan="6"><i class="text-muted">Note: this deity has been reprinted in a newer publication.</i></td></tr>` : ""}
		${Renderer.utils.getPageTr(deity)}
		${deity.previousVersions ? `
		${Renderer.utils.getDividerTr()}
		${deity.previousVersions.map((d, i) => getDeityBody(d, i + 1)).join(Renderer.utils.getDividerTr())}
		` : ""}
		${Renderer.utils.getBorderTr()}
	`);

	ListUtil.updateSelected();
}

function loadSubHash (sub) {
	sub = filterBox.setFromSubHashes(sub);
	ListUtil.setFromSubHashes(sub);
}
