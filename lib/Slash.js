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
var builtinSegments = require( './builtinSegments.js' ) ;

var termkit = require( 'terminal-kit' ) ;
var kungFig = require( 'kung-fig' ) ;
var shellParser = require( '@cronvel/shell-quote' ).parse ;
var string = require( 'string-kit' ) ;

function noop() {}



function Slash( options ) { return Slash.create( options ) ; } 

module.exports = Slash ;



Slash.create = function create( options )
{
	options = options || {} ;
	
	var self = Object.create( Slash.prototype , {
		term: { value: options.term || termkit.terminal , writable: true , enumerable: true } ,
		cwd: { value: options.cwd || process.cwd() , writable: true , enumerable: true } ,
		localDir: { value: options.localDir || os.homedir() + '/.slash' , writable: true , enumerable: true } ,
		env: { value: {} , writable: true , enumerable: true } ,
		binPaths: { value: null , writable: true , enumerable: true } ,
		commandList: { value: null , writable: true , enumerable: true } ,
		extensionPaths: { value: null , writable: true , enumerable: true } ,
		rootMagicTokens: { value: {} , writable: true , enumerable: true } ,
		magicTokens: { value: null , writable: true , enumerable: true } ,
		fontLevel: { value: options.fontLevel !== undefined ? + options.fontLevel || 0 : 1 , writable: true , enumerable: true } ,
		segments: { value: {} , writable: true , enumerable: true } ,
		activeSegments: { value: null , writable: true , enumerable: true } ,
		segmentSeparator: { value: '' , writable: true , enumerable: true } ,
		previousSegmentBgColor: { value: null , writable: true , enumerable: true } ,
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
		theme: { value: {} , writable: true , enumerable: true } ,
	} ) ;
	
	Object.assign( self.env , options.env || process.env ) ;
	
	self.binPaths = self.env.PATH.split( /:/ ) || [] ;
	
	Object.assign( self.functions , builtinFunctions ) ;
	if ( options.functions ) { Object.assign( self.functions , options.functions ) ; }
	
	Object.assign( self.segments , builtinSegments ) ;
	if ( options.segments ) { Object.assign( self.segments , options.segments ) ; }
	Object.keys( self.segments ).forEach( key => { self.segments[ key ].key = key ; } ) ;
	
	if ( options.activeSegments )
	{
		self.activeSegments = options.activeSegments ;
	}
	else
	{
		self.activeSegments = [
			{ fn: self.segments.loadAvgBars , bgColor: '#003355' } ,
			{ fn: self.segments.userAtHostname , bgColor: '#335500' } ,
			{ fn: self.segments.cwd , bgColor: '#558800' } ,
			//{ bgColor: '#335500' , str: '^Y${username}^:@^M${hostname}^::^C${cwd}^:${end}' } ,
		] ;
	}
	
	Object.assign( self.autoCompleters , builtinAutoCompleters ) ;
	
	self.commandList = Object.keys( self.functions ) ;
	
	if ( options.extensionPaths ) { self.extensionPaths = [].concat( options.extensionPaths , __dirname + '/extensions' ) ; }
	else { self.extensionPaths = [ __dirname + '/extensions' , self.localDir + '/extensions' ] ; }
	
	self.buildData() ;
	
	return self ;
} ;



Slash.prototype.init = function init( callback )
{
	this.loadUserPrefs( () => {
		
		switch ( this.fontLevel )
		{
			case 0 :
				this.segmentSeparator = '█ ' ;
				break ;
			case 1 :
				this.segmentSeparator = '█ ' ;
				break ;
			case 2 :
				this.segmentSeparator = '█ ' ;
				break ;
		}
		
		this.updateCommandList( () => {
			this.loadMagicLoop( 0 , callback ) ;
		} ) ;
	} ) ;
} ;



Slash.prototype.save = function save( callback )
{
	fsKit.ensurePath( this.localDir , ( error ) => {
		
		if ( error ) { callback() ; return ; } // We don't care, we just skip user prefs
		
		kungFig.saveKfg( this.history , this.localDir + '/history.kfg' ) ;
		
		var config = {
			fontLevel: this.fontLevel ,
			segments: [] ,
			theme: this.theme
		} ;
		
		this.activeSegments.forEach( segment => {
			var o = {} ;
			
			if ( typeof segment.str === 'string' ) { o.str = segment.str ; }
			if ( typeof segment.fn === 'function' ) { o.fn = segment.fn.key ; }
			
			o.fgColor = segment.fgColor ;
			o.bgColor = segment.bgColor ;
			
			config.segments.push( o ) ;
		} ) ;
		
		kungFig.saveKfg( config , this.localDir + '/config.kfg' ) ;
		
		callback() ;
	} ) ;
} ;



Slash.prototype.loadUserPrefs = function loadUserPrefs( callback )
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
				if ( config.fontLevel ) { this.fontLevel = config.fontLevel ; }
				
				if ( Array.isArray( config.segments ) && config.segments.length )
				{
					// Remove all segments
					this.activeSegments.length = 0 ;
					
					config.segments.forEach( segment => {
						if ( segment.fn )
						{
							if ( this.segments[ segment.fn ] )
							{
								segment.fn = this.segments[ segment.fn ] ;
								this.activeSegments.push( segment ) ;
							}
						}
						if ( typeof segment.str === 'string' )
						{
							this.activeSegments.push( segment ) ;
						}
					} ) ;
				}
				
				if ( config.theme ) { this.theme = config.theme ; }
			}
		}
		catch ( error ) {}	// Most probably the file does not exist, but we don't care
		
		callback() ;
	} ) ;
} ;



Slash.prototype.updateCommandList = function updateCommandList( callback )
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



Slash.prototype.loadMagicLoop = function loadMagicLoop( index , callback )
{
	if ( index >= this.extensionPaths.length ) { callback() ; return ; }
	
	var dirPath = this.extensionPaths[ index ] + '/magic' ;
	
	this.lazyLoadMagic( this.rootMagicTokens , dirPath , this.loadMagicLoop.bind( this , index + 1 , callback ) ) ;
} ;



Slash.prototype.lazyLoadMagic = function lazyLoadMagic( object , dirPath , callback )
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
						get: Slash.lazyLoadMagicGetter.bind( object , token , file )
					} ) ;
					
					//object[ token ] = file ;
				}
			} ) ;
		}
		
		callback() ;
	} ) ;
} ;



Slash.lazyLoadMagicGetter = function lazyLoadMagicGetter( token , file )
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



Slash.prototype.buildData = function buildData()
{
	Object.defineProperties( this.data , {
		u: { get: () => os.userInfo().username } ,
		username: { get: () => os.userInfo().username } ,
		h: { get: () => os.hostname() } ,
		hostname: { get: () => os.hostname() } ,
		cwd: { get: () => this.cwd } ,
		cwdBasename: { get: () => path.basename( this.cwd ) } ,
		end: { get: () => os.userInfo().username === 'root' ? '#' : '$' } ,
		sp: { get: () => this.segmentSeparator } ,
	} ) ;
} ;



Slash.prototype.run = function run( callback )
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



Slash.prototype.runLoop = function runLoop( callback )
{
	this.displayPrompt( ( error ) => {
		
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



Slash.prototype.displayPrompt = function displayPrompt( callback )
{
	if ( ! this.activeSegments.length )
	{
		this.term( '> ' ) ;
		process.nextTick( callback ) ;
		return ;
	}
	
	this.promptSegmentLoop( 0 , callback ) ;
} ;



Slash.prototype.addSegment = function addSegment( str , options )
{
	// If there was already a segment before, add the segment separator
	if ( this.previousSegmentBgColor )
	{
		this.term.noFormat.colorRgbHex.bgColorRgbHex( this.previousSegmentBgColor , options.bgColor , this.segmentSeparator ) ;
	}
	
	// Set up the reset string
	this.term.resetString = this.term.str.colorRgbHex.bgColorRgbHex( options.fgColor , options.bgColor ) ;
	
	// Output the segment
	this.term.markupOnly( str ) ;
	
	// Update the last color
	this.previousSegmentBgColor = options.bgColor ;
} ;



Slash.prototype.promptSegmentLoop = function promptSegmentLoop( index , callback )
{
	var segment , options ;
	
	this.previousSegmentBgColor = null ;
	
	while ( index < this.activeSegments.length )
	{
		segment = this.activeSegments[ index ] ;
		segment.fgColor = segment.fgColor || '#eeeeee' ;
		segment.bgColor = segment.bgColor || '#000000' ;
		
		options = {} ;
		Object.assign( options , segment ) ;
		
		// This should be placed here AND in .addSegment(), because the fn can use term functions
		this.term.resetString = this.term.str.colorRgbHex.bgColorRgbHex( options.fgColor , options.bgColor ) ;
		
		if ( segment.fn )
		{
			if ( segment.fn.length === 3 )
			{
				segment.fn( this , options , this.promptSegmentLoop.bind( this , index + 1 ) ) ;
				return ;
			}
			else
			{
				segment.fn( this , options ) ;
			}
		}
		else if ( segment.str )
		{
			this.segments.fromString( this , options ) ;
		}
		
		index ++ ;
	}
	
	this.term.resetString = '' ;
	this.term.styleReset() ;
	
	if ( this.previousSegmentBgColor )
	{
		this.term.noFormat.colorRgbHex( this.previousSegmentBgColor , this.segmentSeparator ) ;
	}
	
	process.nextTick( callback ) ;
} ;



Slash.prototype.getCommand = function getCommand( callback )
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
			
			command = command.trim() ;
			
			// Add the line to the history if not blank and if it is not the same than the previous line
			if ( command && this.history[ this.history.length - 1 ] !== command )
			{
				this.history.push( command ) ;
			}
			
			callback( error , command ) ;
		}
	) ;
} ;



Slash.prototype.runCommand = function runCommand( command , callback )
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



Slash.prototype.parseCommand = function parseCommand( command , callback )
{
	var parsedExpanded = [] ;
	var parsed = shellParser( command , this.env ) ;
	
	//console.log( "Raw parse:" , parsed ) ;
	
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
		
		//this.term( "%s" , string.inspect( { depth: 7 , style: 'color' } , parsedCommands ) ) ;
		callback( undefined , parsedCommands ) ;
	} ) ;
} ;



// Parse parenthesis and check if they are balanced
Slash.prototype.parseParenthesis = function parseParenthesis( input )
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
		else if ( input[ i ].op === '$(' )
		{
			stack.push( level ) ;
			level ++ ;
			
			nested = { substitute: true , subCommand: [] } ;
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



Slash.prototype.parseCommandBlock = function parseCommandBlock( block , parsed )
{
	var i , iMax , part , index , commandObject = {} , nextCommandObject = null , currentSubstitution ;
	
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
				throw new Error( "Syntax error: operator not following a command" ) ;
			}
			
			nextCommandObject = {} ;
			
			if ( part.subCommand )
			{
				if ( part.substitute )
				{
					if ( ! commandObject.args ) { commandObject.args = [] ; }
					
					currentSubstitution = [] ;
					commandObject.args.push( currentSubstitution ) ;
					
					this.parseCommandBlock( currentSubstitution , part.subCommand ) ;
					
					commandObject.lastCommand = currentSubstitution[ currentSubstitution.length - 1 ] ;
					
					/*
					while ( commandObject.lastCommand.lastCommand )
					{
						commandObject.lastCommand = commandObject.lastCommand.lastCommand
					}
					*/
					
					commandObject.lastCommand.pipeOut = true ;
					commandObject.lastCommand.substitute = true ;
					commandObject.lastCommand.substituteCommand = commandObject ;
					commandObject.lastCommand.substituteInBlock = block ;
				}
				else
				{
					commandObject.subCommand = [] ;
					this.parseCommandBlock( commandObject.subCommand , part.subCommand ) ;
				}
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
Slash.prototype.expandParsedGlobs = function expandParsedGlobs( parsed , parsedExpanded , index , callback )
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



Slash.prototype.runCommandLoop = function runCommandLoop( commandBlock , commandIndex , callback , error , code )
{
	if ( error ) { callback( error ) ; return ; }
	
	if ( commandIndex >= commandBlock.length )
	{
		callback( undefined , code ) ;
		return ;
	}
	
	var commandObject = commandBlock[ commandIndex ] ;
	var nextCommandObject = commandBlock[ commandIndex + 1 ] ;
	
	this.runSubstitutionLoop( commandObject , 0 , ( error ) => {
		
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
	} ) ;
} ;



Slash.prototype.runSubstitutionLoop = function runSubstitutionLoop( commandObject , index , callback )
{
	if ( ! commandObject.args )
	{
		callback() ;
		return ;
	}
	
	for ( ; index < commandObject.args.length ; index ++ )
	{
		if ( Array.isArray( commandObject.args[ index ] ) )
		{
			this.runCommandLoop( commandObject.args[ index ] , 0 , ( error , code ) => {	// jshint ignore:line
				//console.log( "Got buffer:" , commandObject.substituteBuffer ) ;
				
				// Parse again arguments
				var parsed = shellParser( commandObject.substituteBuffer , this.env )
					.map( part => typeof part === 'object' ? part.op : part ) ;
				
				//console.log( "parsed:" , parsed ) ;
				//console.log( "before:" , commandObject ) ;
				
				if ( ! commandObject.program && parsed.length )
				{
					commandObject.program = parsed.shift() ;
				}
				
				commandObject.args.splice( index , 1 , ... parsed ) ;
				//console.log( "after:" , commandObject ) ;
				
				this.runSubstitutionLoop( commandObject , index + parsed.length , callback ) ;
			} ) ;
			
			return ;
		}
	}
	
	callback() ;
} ;



// Run either a program (external) a function (internal) or a sub-command
Slash.prototype.runAnything = function runAnything( commandObject , callback )
{
	var result ;
	
	if ( commandObject.subCommand )
	{
		// This is a sub-command
		this.runCommandLoop( commandObject.subCommand , 0 , callback ) ;
		return ;
	}
	
	if ( ! commandObject.program )
	{
		// Nothing to run... 
		callback() ;
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
Slash.prototype.runProgram = function runProgram( commandObject , callback )
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
					this.term.red( 'No such program: %s\n' , commandObject.program ) ;
					break ;
				case 'EACCES' :
					// No permission, or not executable
					this.term.red( 'Cannot execute program: %s\n' , commandObject.program ) ;
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
			// This is a redirection from a file
			
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
			// This is a redirection to a file
			
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
		else if ( commandObject.substitute )
		{
			commandObject.substituteCommand.substituteBuffer = '' ;
			
			child.stdout.on( 'data' , ( data ) => commandObject.substituteCommand.substituteBuffer += data.toString() ) ;
			child.stdout.on( 'error' , noop ) ;
			
			if ( commandObject.mergeOutAndErr )
			{
				child.stderr.on( 'data' , ( data ) => commandObject.substituteCommand.substituteBuffer += data.toString() ) ;
				child.stderr.on( 'error' , noop ) ;
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



Slash.prototype.debugCompareAttr = function debugCompareAttr( fd1 , fd2 )
{
	var attr1 = termios.getattr( fd1 ) ;
	var attr2 = termios.getattr( fd2 ) ;
	
	Object.keys( attr1.iflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.iflag[ k ] , attr2.iflag[ k ] ) ) ;
	Object.keys( attr1.oflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.oflag[ k ] , attr2.oflag[ k ] ) ) ;
	Object.keys( attr1.cflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.cflag[ k ] , attr2.cflag[ k ] ) ) ;
	Object.keys( attr1.lflag ).forEach( k => this.term( "%s" , k ).column( 16 , "%s\t%s\n" , attr1.lflag[ k ] , attr2.lflag[ k ] ) ) ;
} ;



// Master autoComplete
Slash.prototype.masterAutoComplete = function masterAutoComplete( inputString , callback )
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



Slash.prototype.tokenResetHook = function tokenResetHook( term , config )
{
	this.autoComplete = this.autoCompleters.bin ;
	this.magicTokens = this.rootMagicTokens ;
	this.lastTokenIsEndOfInput = true ;
	this.tokenChain.length = 0 ;
} ;



// Master tokenHook
Slash.prototype.masterTokenHook = function masterTokenHook( token , isEndOfInput , previousTokens , term , config )
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
Slash.prototype.runProgramPty = function runProgramPty( commandObject , callback )
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

