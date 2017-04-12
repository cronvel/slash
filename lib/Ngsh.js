/*
	Next Gen Shell
	
	Copyright (c) 2017 Cédric Ronvel
	
	The MIT License (MIT)
	
	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:
	
	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.
	
	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



var path = require( 'path' ) ;
var glob = require( 'glob' ) ;
var fs = require( 'fs' ) ;
var os = require( 'os' ) ;
var fsKit = require( 'fs-kit' ) ;
var spawn = require( 'child_process' ).spawn ;
var ptySpawn = require( 'child_pty' ).spawn ;

// Optional dependencies
try {
	var termios = require( 'termios' ) ;
} catch( error ) {}

var builtinFunctions = require( './builtinFunctions.js' ) ;
var builtinAutoCompleters = require( './builtinAutoCompleters.js' ) ;
var builtinPrompts = require( './builtinPrompts.js' ) ;

var termkit = require( 'terminal-kit' ) ;
var kungFig = require( 'kung-fig' ) ;
var shellParser = require( '@cronvel/shell-quote' ).parse ;
var string = require( 'string-kit' ) ;

function noop() {}



function Ngsh( options ) { return Ngsh.create( options ) ; } 

module.exports = Ngsh ;



Ngsh.create = function create( options )
{
	options = options || {} ;
	
	var self = Object.create( Ngsh.prototype , {
		term: { value: options.term || termkit.terminal , writable: true , enumerable: true } ,
		cwd: { value: options.cwd || process.cwd() , writable: true , enumerable: true } ,
		localDir: { value: options.localDir || os.homedir() + '/.ngsh' , writable: true , enumerable: true } ,
		env: { value: {} , writable: true , enumerable: true } ,
		binPaths: { value: null , writable: true , enumerable: true } ,
		commandList: { value: null , writable: true , enumerable: true } ,
		extensionPaths: { value: null , writable: true , enumerable: true } ,
		rootMagicTokens: { value: {} , writable: true , enumerable: true } ,
		magicTokens: { value: null , writable: true , enumerable: true } ,
		prompts: { value: {} , writable: true , enumerable: true } ,
		activePrompts: { value: null , writable: true , enumerable: true } ,
		autoComplete: { value: null , writable: true , enumerable: true } ,
		autoCompleters: { value: {} , writable: true , enumerable: true } ,
		produceCompletion: { value: termkit.autoComplete , writable: true , enumerable: true } ,
		tokenChain: { value: [] , writable: true , enumerable: true } ,
		lastTokenIsEndOfInput: { value: true , writable: true , enumerable: true } ,
		history: { value: options.history || null , writable: true , enumerable: true } ,
		functions: { value: {} , writable: true , enumerable: true } ,
		stdin: { value: options.stdin || process.stdin , writable: true , enumerable: true } ,
		stdout: { value: options.stdout || process.stdout , writable: true , enumerable: true } ,
		stderr: { value: options.stderr || process.stderr , writable: true , enumerable: true } ,
		isRunningCommands: { value: false , writable: true , enumerable: true } ,
		data: { value: {} , writable: true , enumerable: true } ,
	} ) ;
	
	Object.assign( self.env , options.env || process.env ) ;
	
	self.binPaths = self.env.PATH.split( /:/ ) || [] ;
	
	Object.assign( self.functions , builtinFunctions ) ;
	if ( options.functions ) { Object.assign( self.functions , options.functions ) ; }
	
	Object.assign( self.prompts , builtinPrompts ) ;
	if ( options.prompts ) { Object.assign( self.prompts , options.prompts ) ; }
	Object.keys( self.prompts ).forEach( key => { self.prompts[ key ].key = key ; } ) ;
	
	if ( options.activePrompts )
	{
		self.activePrompts = options.activePrompts ;
	}
	else
	{
		self.activePrompts = [ self.prompts.loadAvgColors , ' ' , '^Y${username}^:@^m${hostname}^::^b${cwd}^:${separator} ' ] ;
	}
	
	Object.assign( self.autoCompleters , builtinAutoCompleters ) ;
	
	self.commandList = Object.keys( self.functions ) ;
	
	if ( options.extensionPaths ) { self.extensionPaths = [].concat( options.extensionPaths , __dirname + '/extensions' ) ; }
	else { self.extensionPaths = [ __dirname + '/extensions' , self.localDir + '/extensions' ] ; }
	
	self.buildData() ;
	
	return self ;
} ;



Ngsh.prototype.init = function init( callback )
{
	this.loadUserPrefs( () => {
		this.updateCommandList( () => {
			this.loadMagicLoop( 0 , callback ) ;
		} ) ;
	} ) ;
} ;



Ngsh.prototype.save = function save( callback )
{
	fsKit.ensurePath( this.localDir , ( error ) => {
		
		if ( error ) { callback() ; return ; } // We don't care, we just skip user prefs
		
		kungFig.saveKfg( this.history , this.localDir + '/history.kfg' ) ;
		
		var config = {
			prompt: []
		} ;
		
		this.activePrompts.forEach( part => {
			if ( typeof part === 'string' ) { config.prompt.push( part ) ; }
			if ( part && typeof part === 'function' ) { config.prompt.push( { fn: part.key } ) ; }
		} ) ;
		
		kungFig.saveKfg( config , this.localDir + '/config.kfg' ) ;
		
		callback() ;
	} ) ;
} ;



Ngsh.prototype.loadUserPrefs = function loadUserPrefs( callback )
{
	fsKit.ensurePath( this.localDir , ( error ) => {
		
		if ( error ) { callback() ; return ; } // We don't care, we just skip user prefs
		
		var history , config ;
		
		if ( ! this.history )
		{
			try {
				history = kungFig.load( this.localDir + '/history.kfg' ) ;
				if ( ! Array.isArray( history ) ) { this.history = [] ; }
				else { this.history = history.filter( e => typeof e === 'string' ) ; }
			}
			catch ( error ) {}	// Most probably the file does not exist, but we don't care
		}
		
		try {
			config = kungFig.load( this.localDir + '/config.kfg' ) ;
			
			if ( config && typeof config === 'object' )
			{
				if ( typeof config.prompt === 'string' ) { config.prompt = [ config.prompt ] ; }
				if ( Array.isArray( config.prompt ) && config.prompt.length )
				{
					// Remove all prompts
					this.activePrompts.length = 0 ;
					
					config.prompt.forEach( part => {
						if ( typeof part === 'string' )
						{
							this.activePrompts.push( part ) ;
						}
						else if ( part && typeof part === 'object' && this.prompts[ part.fn ] )
						{
							this.activePrompts.push( this.prompts[ part.fn ] ) ;
						}
					} ) ;
				}
			}
		}
		catch ( error ) {}	// Most probably the file does not exist, but we don't care
		
		callback() ;
	} ) ;
} ;



Ngsh.prototype.updateCommandList = function updateCommandList( callback )
{
	var readdirOptions = { directories: false , exe: true } ;
	var remaining = this.binPaths.length ;
	var commandList = {} ;
	var triggered = false ;
	
	Object.assign( commandList , this.functions ) ;
	
	var triggerCallback = error => {
		
		if ( triggered ) { return ; }
		triggered = true ;
		
		this.commandList = Object.keys( commandList ) ;
		callback() ;
	} ;
	
	this.binPaths.forEach( binPath => {
		
		fsKit.readdir( binPath , readdirOptions , ( error , files ) => {
			remaining -- ;
			
			if ( error )
			{
				//triggerCallback( error ) ;
				if ( remaining <= 0 ) { triggerCallback() ; }
				return ;
			}
			
			files.forEach( file => { commandList[ file ] = true ; } ) ;
			
			if ( remaining <= 0 ) { triggerCallback() ; }
		} ) ;
	} ) ;
} ;



Ngsh.prototype.loadMagicLoop = function loadMagicLoop( index , callback )
{
	if ( index >= this.extensionPaths.length ) { callback() ; return ; }
	
	var dirPath = this.extensionPaths[ index ] + '/magic' ;
	
	this.lazyLoadMagic( this.rootMagicTokens , dirPath , this.loadMagicLoop.bind( this , index + 1 , callback ) ) ;
} ;



Ngsh.prototype.lazyLoadMagic = function lazyLoadMagic( object , dirPath , callback )
{
	fs.readdir( dirPath , ( error , files ) => {
		
		if ( ! error )
		{
			files.forEach( file => {
				
				if ( path.extname( file ) === '.js' )
				{
					var token = path.basename( file , '.js' ) ;
					file = dirPath + '/' + file ;
					//console.log( "adding magic token file:" , file ) ;
					
					Object.defineProperty( object , token , {
						configurable: true ,
						get: Ngsh.lazyLoadMagicGetter.bind( object , token , file )
					} ) ;
					
					//object[ token ] = file ;
				}
			} ) ;
		}
		
		callback() ;
	} ) ;
} ;



Ngsh.lazyLoadMagicGetter = function lazyLoadMagicGetter( token , file )
{
	var module_ = require( file ) ;
	
	if ( ! module_ || typeof module_ !== 'object' )
	{
		Object.defineProperty( this , token , { value: null } ) ;
	}
	else
	{
		Object.defineProperty( this , token , {
			value: module_ ,
			enumerable: true
		} ) ;
	}
	
	return this[ token ] ;
} ;



Ngsh.prototype.buildData = function buildData()
{
	Object.defineProperties( this.data , {
		u: { get: () => os.userInfo().username } ,
		username: { get: () => os.userInfo().username } ,
		h: { get: () => os.hostname() } ,
		hostname: { get: () => os.hostname() } ,
		cwd: { get: () => this.cwd } ,
		cwdname: { get: () => this.cwd.match( /[^\/]*$/ ) } ,
		separator: { get: () => os.userInfo().username === 'root' ? '#' : '$' } ,
	} ) ;
} ;



Ngsh.prototype.run = function run( callback )
{
	var callbackTriggered = false ;
	
	callback = callback || noop ;
	
	var triggerCallback = error => {
		if ( callbackTriggered ) { return ; }
		callbackTriggered = true ;
		
		process.removeListener( 'SIGINT' , onSigInt ) ;
		this.term.off( 'key' , onKey ) ;
		this.term( '\n' ) ;
		
		callback( error ) ;
	} ;
	
	var onKey = key => {
		if ( key === 'CTRL_D' )
		{
			triggerCallback() ;
		}
	} ;
	
	var onSigInt = () => {} ;
	
	process.on( 'SIGINT' , onSigInt ) ;
	this.term.on( 'key' , onKey ) ;
	
	this.runLoop( error => {
		if ( error ) { callback( error ) ; return ; }
		callback() ;
	} ) ;
} ;



Ngsh.prototype.runLoop = function runLoop( callback )
{
	this.masterPrompt( ( error ) => {
		
		if ( error ) { callback( error ) ; return ; }
		
		this.getCommand( ( error , command ) => {
			
			if ( error ) { callback( error ) ; return ; }
			
			this.runCommand( command , ( error , result ) => {
				
				if ( error ) { callback( error ) ; return ; }
				
				this.runLoop( callback ) ;
			} ) ;
		} ) ;
	} ) ;
} ;



Ngsh.prototype.masterPrompt = function masterPrompt( callback )
{
	if ( ! this.activePrompts.length )
	{
		this.term( '> ' ) ;
		process.nextTick( callback ) ;
		return ;
	}
	
	this.promptLoop( 0 , callback ) ;
} ;



Ngsh.prototype.promptLoop = function promptLoop( index , callback )
{
	var fn ;
	
	while ( index < this.activePrompts.length )
	{
		fn = this.activePrompts[ index ] ;
		
		if ( typeof fn === 'function' )
		{
			if ( fn.length === 3 )
			{
				fn( this , null , this.promptLoop.bind( this , index + 1 ) ) ;
				return ;
			}
			else
			{
				fn( this , null ) ;
			}
		}
		else if ( typeof fn === 'string' )
		{
			this.prompts.fromString( this , { str: fn } ) ;
		}
		
		index ++ ;
	}
	
	process.nextTick( callback ) ;
} ;



Ngsh.prototype.getCommand = function getCommand( callback )
{
	this.term.inputField(
		{
			history: this.history ,
			autoComplete: this.masterAutoComplete.bind( this ) ,
			tokenResetHook: this.tokenResetHook.bind( this ) ,
			tokenHook: this.masterTokenHook.bind( this ) ,
			autoCompleteHint: true ,
			autoCompleteMenu: true
		} ,
		( error , command ) => {
			this.term( '\n' ) ;
			if ( command.trim() ) { this.history.push( command ) ;	} // Add the line to the history
			
			callback( error , command ) ;
		}
	) ;
} ;



Ngsh.prototype.runCommand = function runCommand( command , callback )
{
	//var triggered = false ;
	
	this.parseCommand( command , ( error , parsedCommands ) =>
	{
		if ( error )
		{
			// Parse error
			this.term.red( "Command parse error: %E" , error ) ;
			callback() ;
			return ;
		}
		
		if ( ! parsedCommands )
		{
			// No command, nothing to do...
			callback() ;
			return ;
		}
		
		//console.log( 'Parsed commands:' , parsedCommands ) ;
		
		this.isRunningCommands = true ;
		
		// Turn input grabing off
		this.term.grabInput( false ) ;
		
		this.runCommandLoop( parsedCommands , 0 , ( error ) => {
			this.isRunningCommands = false ;
			
			// Turn input grabing on again
			this.term.grabInput( true ) ;
			
			callback( error ) ;
		} ) ;
	} ) ;
} ;



Ngsh.prototype.parseCommand = function parseCommand( command , callback )
{
	var parsedExpanded = [] ;
	var parsed = shellParser( command , this.env ) ;
	
	console.log( "Raw parse:" , parsed ) ;
	
	if ( ! parsed || ! parsed.length )
	{
		callback( undefined , null ) ;
		return ;
	}
	
	this.expandParsedGlobs( parsed , parsedExpanded , 0 , () => {
		
		var parsedCommands = [] ;
		parsed = parsedExpanded ;
		
		try {
			parsed = this.parseParenthesis( parsed ) ;
			this.parseCommandBlock( parsedCommands , parsed ) ;
		}
		catch ( error ) {
			callback( error ) ;
			return ;
		}
		
		//console.log( parsedCommands ) ;
		callback( undefined , parsedCommands ) ;
	} ) ;
} ;



// Parse parenthesis and check if they are balanced
Ngsh.prototype.parseParenthesis = function parseParenthesis( input )
{
	var i , iMax , level = 0 , output = [] , stack = [] , outputPointer = output , nested ;
	
	for ( i = 0 , iMax = input.length ; i < iMax ; i ++ )
	{
		if ( input[ i ].op === '(' )
		{
			stack.push( level ) ;
			level ++ ;
			
			nested = { subCommand: [] } ;
			outputPointer.push( nested ) ;
			stack.push( outputPointer ) ;
			outputPointer = nested.subCommand ;
		}
		else if ( input[ i ].op === ')' )
		{
			if ( -- level < 0 )
			{
				throw new Error( "Syntax error: unmatched parenthesis" ) ;
			}
			
			outputPointer = stack.pop() ;
		}
		else
		{
			outputPointer.push( input[ i ] ) ;
		}
	}
	
	if ( level )
	{
		throw new Error( "Syntax error: unmatched parenthesis" ) ;
	}
	
	return output ;
} ;



Ngsh.prototype.parseCommandBlock = function parseCommandBlock( block , parsed )
{
	var i , iMax , part , index , commandObject = {} , nextCommandObject = null ;
	
	//this.term( "%s" , string.inspect( { depth: 5 , style: 'color' } , parsed ) ) ;
	
	var command = [] ;
	
	i = 0 ;
	index = 0 ;
	iMax = parsed.length ;
	
	while ( i < iMax )
	{
		part = parsed[ i ] ;
		
		if ( part && typeof part === 'object' )
		{
			if ( ! commandObject.program && ! part.subCommand )
			{
				throw new Error( "Syntax error (E1)" ) ;
			}
			
			nextCommandObject = {} ;
			
			if ( part.subCommand )
			{
				commandObject.subCommand = [] ;
				this.parseCommandBlock( commandObject.subCommand , part.subCommand ) ;
			}
			else if ( part.op === '|' )
			{
				commandObject.pipeOut = nextCommandObject ;
				nextCommandObject.pipeIn = commandObject ;
			}
			else if ( part.op === '<' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeIn = parsed[ i + 1 ] ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '>' || part.op === '1>' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeOut = parsed[ i + 1 ] ;
				commandObject.outFileFlags = 'w' ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '2>' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeErr = parsed[ i + 1 ] ;
				commandObject.errFileFlags = 'w' ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '&>' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeOut = commandObject.pipeErr = parsed[ i + 1 ] ;
				commandObject.outFileFlags = commandObject.errFileFlags = 'w' ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '>>' || part.op === '1>>' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeOut = parsed[ i + 1 ] ;
				commandObject.outFileFlags = 'a' ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '2>>' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeErr = parsed[ i + 1 ] ;
				commandObject.errFileFlags = 'a' ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '&>>' )
			{
				if ( typeof parsed[ i + 1 ] !== 'string' )
				{
					throw new Error( "Syntax error" ) ;
				}
				
				commandObject.pipeOut = commandObject.pipeErr = parsed[ i + 1 ] ;
				commandObject.outFileFlags = commandObject.errFileFlags = 'a' ;
				i += 2 ;
				continue ;
			}
			else if ( part.op === '2>&1' )
			{
				commandObject.mergeOutAndErr = true ;
				i ++ ;
				continue ;
			}
			else if ( part.op === '&&' )
			{
				commandObject.serialize = true ;
				nextCommandObject.skipIfPreviousFailed = true ;
			}
			else if ( part.op === '||' )
			{
				commandObject.serialize = true ;
				nextCommandObject.skipIfPreviousSucceed = true ;
			}
			else if ( part.op === ';' )
			{
				commandObject.serialize = true ;
			}
			
			block.push( commandObject ) ;
			commandObject = nextCommandObject ;
			index = 0 ;
		}
		else
		{
			if ( index === 0 )
			{
				commandObject.program = part ;
				commandObject.args = [] ;
			}
			else
			{
				commandObject.args.push( part ) ;
			}
			
			index ++ ;
		}
		
		i ++ ;
	}
	
	// If defined and has a program
	if ( commandObject && commandObject.program )
	{
		block.push( commandObject ) ;
	}
} ;



// Asynchronously expand glob in a parsed command
Ngsh.prototype.expandParsedGlobs = function expandParsedGlobs( parsed , parsedExpanded , index , callback )
{
	var part ;
	
	while ( index < parsed.length )
	{
		part = parsed[ index ] ;
		
		if ( part && typeof part === 'object' && part.op === 'glob' )
		{
			glob( part.pattern , { cwd: this.cwd } , ( error , paths ) => {	// jshint ignore:line
				paths.forEach( path => parsedExpanded.push( path ) ) ;
				this.expandParsedGlobs( parsed , parsedExpanded , index + 1 , callback ) ;
			} ) ;
				
			return ;
		}
		
		parsedExpanded.push( part ) ;
		index ++ ;
	}
	
	// Avoid synchronous stack overflows
	process.nextTick( callback ) ;
} ;



Ngsh.prototype.runCommandLoop = function runCommandLoop( commandBlock , commandIndex , callback , error , code )
{
	if ( error ) { callback( error ) ; return ; }
	
	if ( commandIndex >= commandBlock.length )
	{
		callback( undefined , code ) ;
		return ;
	}
	
	var commandObject = commandBlock[ commandIndex ] ;
	var nextCommandObject = commandBlock[ commandIndex + 1 ] ;
	
	if ( ! nextCommandObject || commandObject.serialize )
	{
		if ( ( commandObject.skipIfPreviousFailed && code ) || ( commandObject.skipIfPreviousSucceed && ! code ) )
		{
			// Skip, forward current code
			this.runCommandLoop( commandBlock , commandIndex + 1 , callback , error , code ) ;
			return ;
		}
		
		this.runAnything( commandObject , ( error , code ) => {
			this.runCommandLoop( commandBlock , commandIndex + 1 , callback , error , code ) ;
		} ) ;
	}
	else
	{
		this.runAnything( commandObject , ( error , code ) => {
			// What to do there?
		} ) ;
		this.runCommandLoop( commandBlock , commandIndex + 1 , callback ) ;
	}
} ;



Ngsh.prototype.runAnything = function runAnything( commandObject , callback )
{
	var result ;
	
	if ( commandObject.subCommand )
	{
		// This is a sub-command
		this.runCommandLoop( commandObject.subCommand , 0 , callback ) ;
		return ;
	}
	
	if ( commandObject.program.match( /^[^.\/]/ ) && this.functions[ commandObject.program ] )
	{
		// This is an internal command/function
		
		commandObject.isFunction = true ;
		
		if ( this.functions[ commandObject.program ].length === 3 )
		{
			// Async function
			this.functions[ commandObject.program ]( this , commandObject.args , callback ) ;
		}
		else
		{
			// Sync function, use process.nextTick() to keep the flow async
			process.nextTick( () => {
				try {
					result = this.functions[ commandObject.program ]( this , commandObject.args ) ;
					// Transform the result into an UInt8
					result = Math.max( 0 , Math.min( 255 , + result || 0 ) ) ;
				}
				catch ( error ) {
					callback( error ) ;
					return ;
				}
				
				callback( undefined , result ) ;
			} ) ;
		}
		
		return ;
	}
	
	// This is an external command
	this.runProgram( commandObject , callback ) ;
} ;



// Version using child_process
Ngsh.prototype.runProgram = function runProgram( commandObject , callback )
{
	var triggered = false , stdio = [] , outFileStream , stdoutInProgress , stderrInProgress ;
	
	var triggerCallback = ( error , code , signal ) => {
		
		if ( triggered ) { return ; }
		triggered = true ;
		
		child.removeListener( 'error' , onError ) ;
		child.removeListener( 'exit' , onExit ) ;
		
		if ( error )
		{
			switch ( error.code )
			{
				case 'ENOENT' :
					this.term.red( 'No such program\n' ) ;
					break ;
				case 'EACCES' :
					// No permission, or not executable
					this.term.red( 'No such program\n' ) ;
					break ;
				default :
					this.term.red( 'Error: %E' , error ) ;
			}
		}
		
		//console.log( "Run program: exit" ) ;
		callback( undefined , code ) ;
	} ;
	
	var onError = error => {
		triggerCallback( error ) ;
	} ;
	
	var onExit = ( code , signal ) => {
		triggerCallback( null , code , signal ) ;
	} ;
	
	stdio[ 0 ] = commandObject.pipeIn ? 'pipe' : this.stdin ;
	stdio[ 1 ] = commandObject.pipeOut ? 'pipe' : this.stdout ;
	
	if ( commandObject.mergeOutAndErr ) { stdio[ 2 ] = stdio[ 1 ] ; }
	else { stdio[ 2 ] = commandObject.pipeErr ? 'pipe' : this.stderr ; }
	
	//console.log( "stdio" , stdio ) ;
	//console.log( "Run program: enter" ) ;
	
	var child = spawn( commandObject.program , commandObject.args , {
		cwd: this.cwd ,
		env: this.env ,
		stdio: stdio ,
		shell: false
	} ) ;
	
	
	if ( commandObject.pipeIn )
	{
		if ( typeof commandObject.pipeIn === 'string' )
		{
			fs.createReadStream( commandObject.pipeIn ).pipe( child.stdin ) ;
		}
		else
		{
			commandObject.stdin = child.stdin ;
			commandObject.pipeIn.stdout.pipe( commandObject.stdin ) ;
			
			if ( commandObject.pipeIn.mergeOutAndErr )
			{
				commandObject.pipeIn.stderr.pipe( commandObject.stdin ) ;
			}
		}
	}
	
	
	if ( commandObject.pipeOut )
	{
		if ( typeof commandObject.pipeOut === 'string' )
		{
			if ( ! commandObject.mergeOutAndErr )
			{
				outFileStream = fs.createWriteStream( commandObject.pipeOut , { flags: commandObject.outFileFlags } ) ;
				child.stdout.pipe( outFileStream ) ;
			}
			else
			{
				outFileStream = fs.createWriteStream( commandObject.pipeOut , {
					flags: commandObject.outFileFlags ,
					autoClose: false
				} ) ;
				
				stdoutInProgress = stderrInProgress = true ;
				
				child.stdout.pipe( outFileStream , { end: false } ) ;
				child.stderr.pipe( outFileStream , { end: false } ) ;
				
				child.stdout.on( 'end' , () => {
					//console.log( 'stdout end' ) ;
					stdoutInProgress = false ;
					if ( ! stderrInProgress ) { outFileStream.close() ; }
				} ) ;
				
				child.stdout.on( 'error' , error => {
					stdoutInProgress = false ;
					if ( ! stderrInProgress ) { outFileStream.close() ; }
				} ) ;
				
				child.stderr.on( 'end' , () => {
					//console.log( 'stderr end' ) ;
					stderrInProgress = false ;
					if ( ! stdoutInProgress ) { outFileStream.close() ; }
				} ) ;
				
				child.stderr.on( 'error' , () => {
					stderrInProgress = false ;
					if ( ! stdoutInProgress ) { outFileStream.close() ; }
				} ) ;
			}
		}
		else
		{
			commandObject.stdout = child.stdout ;
			
			if ( commandObject.mergeOutAndErr )
			{
				commandObject.stderr = child.stderr ;
			}
		}
	}
	
	
	if ( commandObject.pipeErr && ! commandObject.mergeOutAndErr )
	{
		if ( typeof commandObject.pipeErr === 'string' )
		{
			child.stderr.pipe(
				commandObject.pipeOut === commandObject.pipeErr ?
				outFileStream :
				fs.createWriteStream( commandObject.pipeErr , { flags: commandObject.errFileFlags } )
			) ;
		}
		else
		{
			commandObject.stderr = child.stderr ;
		}
	}
	
	
	child.on( 'error' , onError ) ;
	child.on( 'exit' , onExit ) ;
} ;



Ngsh.prototype.debugCompareAttr = function debugCompareAttr( fd1 , fd2 )
{
	var attr1 = termios.getattr( fd1 ) ;
	var attr2 = termios.getattr( fd2 ) ;
	
	Object.keys( attr1.iflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.iflag[ k ] , attr2.iflag[ k ] ) ) ;
	Object.keys( attr1.oflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.oflag[ k ] , attr2.oflag[ k ] ) ) ;
	Object.keys( attr1.cflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.cflag[ k ] , attr2.cflag[ k ] ) ) ;
	Object.keys( attr1.lflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.lflag[ k ] , attr2.lflag[ k ] ) ) ;
} ;



// Master autoComplete
Ngsh.prototype.masterAutoComplete = function masterAutoComplete( inputString , callback )
{
	var fn ;
	
	if ( typeof this.autoComplete === 'string' && typeof this.autoCompleters[ this.autoComplete ] === 'function' )
	{
		fn = this.autoCompleters[ this.autoComplete ] ;
	}
	else if ( typeof this.autoComplete === 'function' )
	{
		fn = this.autoComplete ;
	}
	else if ( this.autoComplete === false )
	{
		process.nextTick( callback.bind( this , undefined , inputString ) ) ;
		return ;
	}
	else
	{
		fn = this.autoCompleters.default ;
	}
	
	if ( fn.length === 5 )
	{
		fn( this , inputString , this.tokenChain , this.lastTokenIsEndOfInput , callback ) ;
	}
	else
	{
		process.nextTick( callback.bind( this , undefined , fn( this , inputString , this.tokenChain , this.lastTokenIsEndOfInput ) ) ) ;
	}
} ;



Ngsh.prototype.tokenResetHook = function tokenResetHook( term , config )
{
	this.autoComplete = this.autoCompleters.bin ;
	this.magicTokens = this.rootMagicTokens ;
	this.lastTokenIsEndOfInput = true ;
	this.tokenChain.length = 0 ;
} ;



// Master tokenHook
Ngsh.prototype.masterTokenHook = function masterTokenHook( token , isEndOfInput , previousTokens , term , config )
{
	var tokenStyle ;
	
	this.lastTokenIsEndOfInput = isEndOfInput ;
	this.tokenChain.push( token ) ;
	
	if ( ! this.magicTokens || ! this.magicTokens[ token ] || typeof this.magicTokens[ token ] !== 'object' )
	{
		// Unknown token
		this.magicTokens = null ;
		
		// This is the first token, switch to default autoCompleter (path)
		if ( ! isEndOfInput && ! previousTokens.length ) { this.autoComplete = 'default' ; }
		
		return ;
	}
	
	if ( this.magicTokens[ token ].token )
	{
		tokenStyle = this.magicTokens[ token ].token( token , isEndOfInput , previousTokens , term , config , isEndOfInput ) ;
	}
	
	if ( ! isEndOfInput )
	{
		this.autoComplete = this.magicTokens[ token ].autoComplete ;
		this.magicTokens = this.magicTokens[ token ].children ;
	}
	
	return tokenStyle ;
} ;







// - DEPRECATED -

// Version using child_pty
// Not used ATM, but may be useful to provide a TMux mode, where the shell is multiplexed into multiple windows
Ngsh.prototype.runProgramPty = function runProgramPty( commandObject , callback )
{
	var triggered = false ;
	
	var triggerCallback = ( error , code , signal ) => {
		
		if ( triggered ) { return ; }
		triggered = true ;
		
		this.stdin.removeListener( 'data' , onStdin ) ;
		this.stdout.removeListener( 'resize' , onResize ) ;
		child.stdout.removeListener( 'data' , onStdout ) ;
		//child.stderr.removeListener( 'data' , onStderr ) ;
		
		child.removeListener( 'error' , onError ) ;
		child.removeListener( 'exit' , onExit ) ;
		
		if ( error )
		{
			switch ( error.code )
			{
				case 'ENOENT' :
					this.term.red( 'No such program\n' ) ;
					break ;
				case 'EACCES' :
					// No permission, or not executable
					this.term.red( 'No such program\n' ) ;
					break ;
				default :
					this.term.red( 'Error: %E' , error ) ;
			}
		}
		
		callback() ;
	} ;
	
	var onError = error => {
		triggerCallback( error ) ;
	} ;
	
	var onExit = ( code , signal ) => {
		triggerCallback( null , code , signal ) ;
	} ;
	
	var onStdin = chunk => {
		//console.log( "stdin" , chunk ) ;
		child.stdin.write( chunk ) ;
	} ;
	
	var onResize = () => {
		child.stdout.resize( { columns: this.stdout.columns , rows: this.stdout.rows } ) ;
	} ;
	
	var onStdout = chunk => {
		//console.error( "\nstdout: " + string.escape.control( chunk.toString() ) + '\n\n' ) ;
		this.stdout.write( chunk ) ;
	} ;
	
	var onStderr = chunk => {
		//console.log( "stderr" , chunk ) ;
		this.stderr.write( chunk ) ;
	} ;
	
	var child = ptySpawn( commandObject.program , commandObject.args , {
		cwd: this.cwd ,
		env: this.env ,
		shell: false ,
		columns: this.stdout.columns ,
		rows: this.stdout.rows
	} ) ;
	
	//this.debugCompareAttr( this.stdin.fd , child.stdin.fd ) ;
	//this.debugCompareAttr( this.stdout.fd , child.stdout.fd ) ;
	//this.debugCompareAttr( this.stdin.fd , this.stdout.fd ) ;
	
	this.stdout.on( 'resize' , onResize ) ;
	
	/*
	this.stdin.pipe( this.stdin ) ;
	child.stdout.pipe( this.stdout ) ;
	//child.stderr.pipe( this.stderr ) ;
	//*/
	
	this.stdin.on( 'data' , onStdin ) ;
	child.stdout.on( 'data' , onStdout ) ;
	//child.stderr.on( 'data' , onStderr ) ;
	
	child.on( 'error' , onError ) ;
	child.on( 'exit' , onExit ) ;
} ;

