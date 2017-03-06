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



var stream = require( 'stream' ) ;
var spawn = require( 'child_process' ).spawn ;
var ptySpawn = require( 'child_pty' ).spawn ;

var builtinFunctions = require( './builtinFunctions.js' ) ;

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
		history: { value: options.history || [] , writable: true , enumerable: true } ,
		functions: { value: {} , writable: true , enumerable: true } ,
		stdin: { value: options.stdin || process.stdin , writable: true , enumerable: true } ,
		stdout: { value: options.stdout || process.stdout , writable: true , enumerable: true } ,
		stderr: { value: options.stderr || process.stderr , writable: true , enumerable: true } ,
		parsedCommands: { value: null , writable: true , enumerable: true } ,
		commandIndex: { value: 0 , writable: true , enumerable: true } ,
		runningCommands: { value: false , writable: true , enumerable: true } ,
	} ) ;
	
	Object.assign( self.env , options.env || process.env ) ;
	
	Object.assign( self.functions , builtinFunctions ) ;
	if ( options.functions ) { Object.assign( self.functions , options.functions ) ; }
	
	return self ;
} ;



Ngsh.prototype.init = function init()
{
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
	this.prompt( ( error ) => {
		
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



Ngsh.prototype.prompt = function prompt( callback )
{
	this.term( '> ' ) ;
	callback() ;
} ;



var autoComplete = [
	'dnf install' ,
	'dnf install nodejs' ,
	'dnf search' ,
	'sudo' ,
	'sudo dnf install' ,
	'sudo dnf install nodejs' ,
	'sudo dnf search' ,
] ;



Ngsh.prototype.getCommand = function getCommand( callback )
{
	this.term.inputField(
		{
			history: this.history ,
			autoComplete: autoComplete ,
			autoCompleteHint: true ,
			autoCompleteMenu: true ,
			tokenHook: ( token , previousTokens , term , config ) => {
				var previousText = previousTokens.join( ' ' ) ;
				
				switch ( token )
				{
					case 'sudo' :
						config.style = term.red ;
						return previousTokens.length ? null : term.bold.red ;
					case 'dnf' :
						return previousText === '' || previousText === 'sudo' ? term.brightMagenta : null ;
					case 'install' :
						config.style = term.brightBlue ;
						config.hintStyle = term.brightBlack.italic ;
						return previousText === 'dnf' || previousText === 'sudo dnf' ? term.brightYellow : null ;
					case 'search' :
						config.style = term.brightBlue ;
						return previousText === 'dnf' || previousText === 'sudo dnf' ? term.brightCyan : null ;
				}
			}
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
	
	this.runningCommands = true ;
	
	this.runCommandLoop( ( error ) => {
		this.runningCommands = false ;
		callback( error ) ;
	} ) ;
} ;



Ngsh.prototype.parseCommand = function parseCommand( command )
{
	var parsed = parser( command ) ;
	
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
	
	if ( this.functions[ commandObject.program ] )
	{
		if ( this.functions[ commandObject.program ].length === 3 )
		{
			// Async function
			this.functions[ commandObject.program ]( this , commandObject.program.args , cb ) ;
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

