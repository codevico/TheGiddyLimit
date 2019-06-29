"use strict";

const JSON_URL = "data/psionics.json";

const ID_PSIONICS_LIST = "psionicsList";

const CLS_LI_NONE = "list-entry-none";

const LIST_NAME = "name";
const LIST_SOURCE = "source";
const LIST_TYPE = "type";
const LIST_ORDER = "order";
const LIST_MODE_LIST = "mode-list";

function getHiddenModeList (psionic) {
	const modeList = psionic.modes;
	if (modeList === undefined) return "";
	const outArray = [];
	for (let i = 0; i < modeList.length; ++i) {
		outArray.push(`"${modeList[i].name}"`);
		if (modeList[i].submodes != null) {
			const subModes = modeList[i].submodes;
			for (let j = 0; j < subModes.length; ++j) {
				outArray.push(`"${subModes[j].name}"`)
			}
		}
	}
	return outArray.join(",");
}

window.onload = async function load () {
	await ExcludeUtil.pInitialise();
	SortUtil.initHandleFilterButtonClicks();
	DataUtil.loadJSON(JSON_URL).then(onJsonLoad);
};

let list;
let psionicsBookView;
const sourceFilter = getSourceFilter({
	deselFn: () => false
});
let filterBox;
async function onJsonLoad (data) {
	const typeFilter = new Filter({header: "Type", items: [Parser.PSI_ABV_TYPE_TALENT, Parser.PSI_ABV_TYPE_DISCIPLINE], displayFn: Parser.psiTypeToFull});
	const orderFilter = new Filter({
		header: "Order",
		items: ["Avatar", "Awakened", "Immortal", "Nomad", "Wu Jen", Parser.PSI_ORDER_NONE]
	});

	filterBox = await pInitFilterBox({filters: [sourceFilter, typeFilter, orderFilter]});

	list = ListUtil.search({
		valueNames: [LIST_NAME, LIST_SOURCE, LIST_TYPE, LIST_ORDER, LIST_MODE_LIST, "uniqueid"],
		listClass: "psionics",
		sortFunction: SortUtil.listSort
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
		valueNames: ["name", "type", "order", "id"],
		listClass: "subpsionics",
		getSublistRow: getSublistItem
	});
	ListUtil.initGenericPinnable();

	psionicsBookView = new BookModeView("bookview", $(`#btn-psibook`), "If you wish to view multiple psionics, please first make a list",
		($tbl) => {
			const toShow = ListUtil.getSublistedIds().map(id => psionicList[id]);

			const stack = [];
			const renderSpell = (p) => {
				stack.push(`<table class="spellbook-entry"><tbody>`);
				stack.push(Renderer.psionic.getCompactRenderedString(p));
				stack.push(`</tbody></table>`);
			};

			const renderType = (type) => {
				const toRender = toShow.filter(p => p.type === type);
				if (toRender.length) {
					stack.push(Renderer.utils.getBorderTr(`<span class="spacer-name">${Parser.psiTypeToFull(type)}</span>`));

					stack.push(`<tr class="spellbook-level"><td>`);
					toRender.forEach(p => renderSpell(p));
					stack.push(`</td></tr>`);
				}
			};

			renderType("T");
			renderType("D");

			if (!toShow.length && History.lastLoadedId != null) {
				stack.push(`<tr class="spellbook-level"><td>`);
				renderSpell(psionicList[History.lastLoadedId]);
				stack.push(`</td></tr>`);
			}

			$tbl.append(stack.join(""));
			return toShow.length;
		}, true
	);

	addPsionics(data);
	BrewUtil.pAddBrewData()
		.then(handleBrew)
		.then(() => BrewUtil.bind({list}))
		.then(() => BrewUtil.pAddLocalBrewData())
		.catch(BrewUtil.pPurgeBrew)
		.then(async () => {
			BrewUtil.makeBrewButton("manage-brew");
			BrewUtil.bind({filterBox, sourceFilter});
			await ListUtil.pLoadState();

			ListUtil.bindShowTableButton(
				"btn-show-table",
				"Psionics",
				psionicList,
				{
					name: {name: "Name", transform: true},
					source: {name: "Source", transform: (it) => `<span class="${Parser.sourceJsonToColor(it)}" title="${Parser.sourceJsonToFull(it)}" ${BrewUtil.sourceJsonToStyle(it.source)}>${Parser.sourceJsonToAbv(it)}</span>`},
					_text: {name: "Text", transform: (it) => it.type === "T" ? Renderer.psionic.getTalentText(it, renderer) : Renderer.psionic.getDisciplineText(it, renderer), flex: 3}
				},
				{generator: ListUtil.basicFilterGenerator},
				(a, b) => SortUtil.ascSort(a.name, b.name) || SortUtil.ascSort(a.source, b.source)
			);

			RollerUtil.addListRollButton();
			ListUtil.addListShowHide();

			History.init(true);
			ExcludeUtil.checkShowAllExcluded(psionicList, $(`#pagecontent`));
		});
}

function handleBrew (homebrew) {
	addPsionics(homebrew);
	return Promise.resolve();
}

let psionicList = [];
let psI = 0;
function addPsionics (data) {
	if (!data.psionic || !data.psionic.length) return;

	psionicList = psionicList.concat(data.psionic);

	let tempString = "";
	for (; psI < psionicList.length; psI++) {
		const p = psionicList[psI];
		if (ExcludeUtil.isExcluded(p.name, "psionic", p.source)) continue;
		p._fOrder = Parser.psiOrderToFull(p.order);

		tempString += `
			<li class="row" ${FLTR_ID}="${psI}" onclick="ListUtil.toggleSelected(event, this)" oncontextmenu="ListUtil.openContextMenu(event, this)">
				<a id="${psI}" href="#${UrlUtil.autoEncodeHash(p)}" title="${p.name}">
					<span class="${LIST_NAME} col-6">${p.name}</span>
					<span class="${LIST_TYPE} col-2">${Parser.psiTypeToFull(p.type)}</span>
					<span class="${LIST_ORDER} col-2 ${p._fOrder === STR_NONE ? CLS_LI_NONE : ""}">${p._fOrder}</span>
					<span class="${LIST_SOURCE} col-2 text-center" title="${Parser.sourceJsonToFull(p.source)}" ${BrewUtil.sourceJsonToStyle(p.source)}>${Parser.sourceJsonToAbv(p.source)}</span>
					
					<span class="${LIST_MODE_LIST} hidden">${getHiddenModeList(p)}</span>
					<span class="uniqueid hidden">${p.uniqueId ? p.uniqueId : psI}</span>
				</a>
			</li>
		`;

		// populate filters
		sourceFilter.addItem(p.source);
	}
	const lastSearch = ListUtil.getSearchTermAndReset(list);
	$(`#${ID_PSIONICS_LIST}`).append(tempString);

	list.reIndex();
	if (lastSearch) list.search(lastSearch);
	list.sort("name");
	filterBox.render();
	handleFilterChange();

	ListUtil.setOptions({
		itemList: psionicList,
		getSublistRow: getSublistItem,
		primaryLists: [list]
	});
	ListUtil.bindPinButton();
	Renderer.hover.bindPopoutButton(psionicList);
	UrlUtil.bindLinkExportButton(filterBox);
	ListUtil.bindDownloadButton();
	ListUtil.bindUploadButton();
}

function handleFilterChange () {
	const f = filterBox.getValues();
	list.filter(function (item) {
		const p = psionicList[$(item.elm).attr(FLTR_ID)];
		return filterBox.toDisplay(
			f,
			p.source,
			p.type,
			p._fOrder
		);
	});
	FilterBox.selectFirstVisible(psionicList);
}

function getSublistItem (p, pinId) {
	return `
		<li class="row" ${FLTR_ID}="${pinId}" oncontextmenu="ListUtil.openSubContextMenu(event, this)">
			<a href="#${UrlUtil.autoEncodeHash(p)}" title="${p.name}">
				<span class="name col-6 pl-0">${p.name}</span>
				<span class="type col-3">${Parser.psiTypeToFull(p.type)}</span>
				<span class="order col-3 ${p._fOrder === STR_NONE ? CLS_LI_NONE : ""} pr-0">${p._fOrder}</span>
				<span class="id hidden">${pinId}</span>
			</a>
		</li>
	`;
}

let renderer;
function loadHash (jsonIndex) {
	if (!renderer) renderer = Renderer.get();
	renderer.setFirstSection(true);
	const $content = $(`#pagecontent`).empty();

	const psi = psionicList[jsonIndex];

	$content.append(`
		${Renderer.utils.getBorderTr()}
		${Renderer.utils.getNameTr(psi)}
		<tr>
			<td colspan="6"><i>${psi.type === "T" ? Parser.psiTypeToFull(psi.type) : `${psi._fOrder} ${Parser.psiTypeToFull(psi.type)}`}</i><span id="order"></span> <span id="type"></span></td>
		</tr>
		<tr><td class="divider" colspan="6"><div></div></td></tr>
		<tr class="text"><td colspan="6" id="text">${psi.type === "T" ? Renderer.psionic.getTalentText(psi, renderer) : Renderer.psionic.getDisciplineText(psi, renderer)}</td></tr>
		${Renderer.utils.getPageTr(psi)}
		${Renderer.utils.getBorderTr()}
	`);

	loadSubHash([]);

	ListUtil.updateSelected();
}

function loadSubHash (sub) {
	sub = filterBox.setFromSubHashes(sub);
	ListUtil.setFromSubHashes(sub);

	psionicsBookView.handleSub(sub);
}
