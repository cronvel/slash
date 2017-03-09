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
var fs = require( 'fs' ) ;
var os = require( 'os' ) ;
var fsKit = require( 'fs-kit' ) ;
var spawn = require( 'child_process' ).spawn ;
var ptySpawn = require( 'child_pty' ).spawn ;

var builtinFunctions = require( './builtinFunctions.js' ) ;
var builtinAutoCompleters = require( './builtinAutoCompleters.js' ) ;
var builtinPrompts = require( './builtinPrompts.js' ) ;

var termkit = require( 'terminal-kit' ) ;
var parser = require( 'shell-quote' ).parse ;

function noop() {}



function Ngsh( options ) { return Ngsh.create( options ) ; } 

module.exports = Ngsh ;



Ngsh.create = function create( options )
{
	options = options || {} ;
	
	var self = Object.create( Ngsh.prototype , {
		term: { value: options.term || termkit.terminal , writable: true , enumerable: true } ,
		cwd: { value: options.cwd || process.cwd() , writable: true , enumerable: true } ,
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
		history: { value: options.history || [] , writable: true , enumerable: true } ,
		functions: { value: {} , writable: true , enumerable: true } ,
		stdin: { value: options.stdin || process.stdin , writable: true , enumerable: true } ,
		stdout: { value: options.stdout || process.stdout , writable: true , enumerable: true } ,
		stderr: { value: options.stderr || process.stderr , writable: true , enumerable: true } ,
		parsedCommands: { value: null , writable: true , enumerable: true } ,
		commandIndex: { value: 0 , writable: true , enumerable: true } ,
		runningCommands: { value: false , writable: true , enumerable: true } ,
		data: { value: {} , writable: true , enumerable: true } ,
	} ) ;
	
	Object.assign( self.env , options.env || process.env ) ;
	
	self.binPaths = self.env.PATH.split( /:/ ) || [] ;
	
	Object.assign( self.functions , builtinFunctions ) ;
	if ( options.functions ) { Object.assign( self.functions , options.functions ) ; }
	
	Object.assign( self.prompts , builtinPrompts ) ;
	if ( options.prompts ) { Object.assign( self.prompts , options.prompts ) ; }
	
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
	else { self.extensionPaths = [ __dirname + '/extensions' ] ; }
	
	self.buildData() ;
	
	return self ;
} ;



Ngsh.prototype.init = function init( callback )
{
	this.updateCommandList( () => {
		this.loadMagicLoop( 0 , callback ) ;
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
		
		this.term.off( 'key' , onKey ) ;
		this.term( '\n' ) ;
		
		callback( error ) ;
	} ;
	
	var onKey = function( key ) {
		if ( key === 'CTRL_D' )
		{
			triggerCallback() ;
		}
	} ;
	
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
			this.history.push( command ) ;	// Add the line to the history
			
			callback( error , command ) ;
		}
	) ;
} ;



Ngsh.prototype.runCommand = function runCommand( command , callback )
{
	//var triggered = false ;
	
	this.commandIndex = 0 ;
	this.parseCommand( command ) ;
	
	if ( ! this.parsedCommands )
	{
		// No command, nothing to do...
		callback() ;
		return ;
	}
	
	this.runningCommands = true ;
	
	this.runCommandLoop( ( error ) => {
		this.runningCommands = false ;
		callback( error ) ;
	} ) ;
} ;



Ngsh.prototype.parseCommand = function parseCommand( command )
{
	var parsed = parser( command ) ;
	
	if ( ! parsed || ! parsed.length )
	{
		this.parsedCommands = null ;
		return ;
	}
	
	var commandObject = {
		program: parsed[ 0 ] ,
		args: parsed.slice( 1 )
	} ;
	
	this.parsedCommands = [ commandObject ] ;
} ;



Ngsh.prototype.runCommandLoop = function runCommandLoop( callback , error )
{
	if ( error ) { callback( error ) ; return ; }
	
	if ( this.commandIndex >= this.parsedCommands.length )
	{
		callback() ;
		return ;
	}
	
	var cb = this.runCommandLoop.bind( this , callback ) ;
	var commandObject = this.parsedCommands[ this.commandIndex ++ ] ;
	
	// Check if the program is a function
	if ( commandObject.program.match( /^[^.\/]/ ) && this.functions[ commandObject.program ] )
	{
		if ( this.functions[ commandObject.program ].length === 3 )
		{
			// Async function
			this.functions[ commandObject.program ]( this , commandObject.args , cb ) ;
		}
		else
		{
			// Sync function, use process.nextTick() to keep the flow async
			process.nextTick( cb.bind( this , this.functions[ commandObject.program ]( this , commandObject.args ) ) ) ;
		}
		
		return ;
	}
	
	this.runProgram( commandObject , cb ) ;
} ;



// Version using child_pty
Ngsh.prototype.runProgram = function runProgram( commandObject , callback )
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
		//console.log( "stdout" , chunk ) ;
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



// Version using child_process
Ngsh.prototype.runProgram_ = function runProgram( commandObject , callback )
{
	var triggered = false ;
	
	var triggerCallback = ( error , code , signal ) => {
		
		if ( triggered ) { return ; }
		triggered = true ;
		
		this.stdin.removeListener( 'data' , onStdin ) ;
		child.stdout.removeListener( 'data' , onStdout ) ;
		child.stderr.removeListener( 'data' , onStderr ) ;
		child.removeListener( 'error' , onError ) ;
		child.removeListener( 'exit' , onExit ) ;
		
		if ( error ) { callback( error ) ; return ; }
		callback() ;
	} ;
	
	var onError = error => {
		triggerCallback( error ) ;
	} ;
	
	var onExit = ( code , signal ) => {
		triggerCallback( null , code , signal ) ;
	} ;
	
	var onStdin = chunk => {
		console.log( "stdin" , chunk.toString() ) ;
		child.stdin.write( chunk ) ;
	} ;
	
	var onStdout = chunk => {
		console.log( "stdout" , chunk.toString() ) ;
		this.stdout.write( chunk ) ;
	} ;
	
	var onStderr = chunk => {
		console.log( "stderr" , chunk.toString() ) ;
		this.stderr.write( chunk ) ;
	} ;
	
	//this.env = { TERM: 'bobterm' } ;
	//console.log( this.env ) ;
	
	var child = spawn( commandObject.program , commandObject.args , {
		cwd: this.cwd ,
		env: this.env ,
		//stdio: [ this.stdin , this.stdout , this.stderr ] ,
		//stdio: [ 'pipe' , this.stdout , this.stderr ] ,
		stdio: 'pipe' ,
		shell: false
	} ) ;
	
	//child.stdin.write( "toto" ) ;
	
	this.stdin.on( 'data' , onStdin ) ;
	child.stdout.on( 'data' , onStdout ) ;
	child.stderr.on( 'data' , onStderr ) ;
	child.on( 'error' , onError ) ;
	child.on( 'exit' , onExit ) ;
} ;



// Master autoComplete
Ngsh.prototype.masterAutoComplete = function masterAutoComplete( inputString , callback )
{
	var fn ;
	
	if ( typeof this.autoComplete === 'string' )
	{
		fn = this.autoCompleters[ this.autoComplete ] ;
	}
	else
	{
		fn = this.autoComplete ;
	}
	
	fn = fn || this.autoCompleters.default ;
	
	if ( fn.length === 5 )
	{
		fn( this , inputString , this.tokenChain , this.lastTokenIsEndOfInput , callback ) ;
	}
	else
	{
		process.nextTick( callback.bind( this , fn( this , inputString , this.tokenChain , this.lastTokenIsEndOfInput ) ) ) ;
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


