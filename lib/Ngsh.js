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



var termkit = require( 'terminal-kit' ) ;
var execFile = require( 'child_process' ).execFile ;

function noop() {}



function Ngsh( options ) { return Ngsh.create( options ) ; } 

module.exports = Ngsh ;



Ngsh.create = function create( options )
{
	options = options || {} ;
	
	var self = Object.create( Ngsh.prototype , {
		term: { value: options.term || termkit.terminal , writable: true , enumerable: true } ,
	} ) ;
	
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
				
				this.run( callback ) ;
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
		error => {
			this.term( '\n' ) ;
			callback( error ) ;
		}
	) ;
} ;



Ngsh.prototype.runCommand = function runCommand( command , callback )
{
	var child = execFile( 'node' , [ '--version' ], ( error , stdout , stderr ) => {
		if ( error ) { callback( error ) ; return ; }
		
		console.log( 'log:' , stdout ) ;
		callback() ;
	} ) ;
} ;


