const vscode = require('vscode')
const fs = require('fs')
const util = require('./util')

/**
 * 查找文件定义的provider，匹配到了就return一个location，否则不做处理
 * 最终效果是，当按住Ctrl键时，如果return了一个location，字符串就会变成一个可以点击的链接，否则无任何效果
 * @param {*} document 
 * @param {*} position
 */
async function provideDefinition(document, position) {
	const documentFsPath = document.uri.fsPath // Node 能读取到的文件路径
	const documentPath = document.uri.path
	const workspacePath = vscode.workspace.workspaceFolders[0].uri.path.substr(1)
	const word		= document.getText(document.getWordRangeAtPosition(position))
	const line		= document.lineAt(position)
	
	const storePathArr = vscode.workspace.getConfiguration().get('vuex_peek.storePath')
	const storePath = util.findStorePath(storePathArr, documentPath)
	// 光标所在行的文字内容
	const lineText = line.text.trim()
	// 只处理package.json文件
	if (lineText.slice(0, 2) === 'vx') {
		const vuexType = await judegeVuexType(documentFsPath)
		let filename
		let destPath
		switch (vuexType) {
			case '0':
				filename = 'index.js'
				destPath = handleState(lineText, workspacePath, storePath)
				break;
			case '1':
				filename = 'actions.js'
				destPath = handleAMG(lineText, workspacePath, storePath, filename)
				break;
			case '2':
				filename = 'mutaions.js'
				destPath = handleAMG(lineText, workspacePath, storePath, filename)
				break;
			case '3':
				filename = 'getters.js'
				destPath = handleAMG(lineText, workspacePath, storePath, filename)
				break;
			default:
				filename = 'index.js';
		}
		
		if (fs.existsSync(destPath)) {
			const row = await util.getLineNum(destPath, word)
			return new vscode.Location(vscode.Uri.file(destPath), new vscode.Position(row - 1, 0))
		}
	}
}

async function judegeVuexType(documentFsPath) {
	const lineOfMapState = await util.getLineNum(documentFsPath, '\\.\\.\\.mapState')
	const lineOfMapGetters = await util.getLineNum(documentFsPath, '\\.\\.\\.mapGetters')
	const lineOfMapMutations = await util.getLineNum(documentFsPath, '\\.\\.\\.mapMutations')
	const lineOfMapActions = await util.getLineNum(documentFsPath, '\\.\\.\\.mapActions')

	const lineList = [lineOfMapState, lineOfMapGetters, lineOfMapMutations, lineOfMapActions]
	const lineListBigerThanZero = lineList.filter(line => line > 0)
	const minLine = Math.min(...lineListBigerThanZero)

	return lineList.indexOf(minLine)
}

function handleState(lineText, workspacePath, storePath) {
  let address
  if (/=>/.test(lineText)) {
    address = lineText.split('=>')[1]
  } else {
    address = util.getQuotedString(lineText)
  }
	const addressArr = address.split('.')
	if (addressArr.length === 2) {
		return `${workspacePath}/${storePath}/store/index.js`
	}
	if (addressArr.length === 3) {
		const module = addressArr[1]
		const upercaseIndex = util.getUpercaseIndex(module)
		const dirname = util.joinString(module, upercaseIndex)
		return `${workspacePath}/${storePath}/store/modules/${dirname}/index.js`
	}
}

function handleAMG(lineText, workspacePath, storePath, filename) {
	const address = util.getQuotedString(lineText)
	const addressArr = address.split('/')
	// vuex 状态没有定义在 module 里
	if (addressArr.length === 1) {
		return `${workspacePath}/${storePath}/store/${filename}`
	}
	// vuex 状态定义在 module 里
	if (addressArr.length === 2) {
		const module = addressArr[0]
		const upercaseIndex = util.getUpercaseIndex(module)
		const dirname = util.joinString(module, upercaseIndex)
		return `${workspacePath}/${storePath}/store/modules/${dirname}/${filename}`
	}
}

exports.activate = function(context) {
	// 注册如何实现跳转到定义，第一个参数表示仅对 vue 文件生效
	context.subscriptions.push(vscode.languages.registerDefinitionProvider(['vue'], {
		provideDefinition
	}))
}
