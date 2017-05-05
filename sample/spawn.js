#!/usr/bin/env node
/*
	Slash
	
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

var spawn = require( 'child_process' ).spawn ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;

var triggered = false ;

var triggerCallback = ( error , code , signal ) => {
	
	if ( triggered ) { return ; }
	triggered = true ;
	
	child.removeListener( 'error' , onError ) ;
	child.removeListener( 'exit' , onExit ) ;
	
	if ( error ) { console.log( error ) ; }
	
	//process.stdin.setRawMode( false ) ;
	process.exit() ;
} ;

var onError = error => {
	triggerCallback( error ) ;
} ;

var onExit = ( code , signal ) => {
	triggerCallback( null , code , signal ) ;
} ;

/*
process.stdin.setRawMode( true ) ;
process.stdin.setRawMode( false ) ;
//*/

/*
var onStdin = data => { console.log( "\nGot data!" + data + "\n" ) ; } ;
process.stdin.on( 'data' , onStdin ) ;
process.stdin.removeListener( 'data' , onStdin ) ;
process.stdin.pause() ;
//*/

//*
term.grabInput( true ) ;
term.grabInput( false ) ;
//*/

var child = spawn( process.argv[ 2 ] , process.argv.slice( 3 ) , {
	cwd: process.cwd() ,
	env: process.env ,
	shell: false ,
	stdio: 'inherit'
} ) ;


child.on( 'error' , onError ) ;
child.on( 'exit' , onExit ) ;
