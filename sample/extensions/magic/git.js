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



//var path = require( 'path' ) ;
//var os = require( 'os' ) ;
var execFile = require( 'child_process' ).execFile ;



exports.token = function token( token , isEndOfInput , previousTokens , term , config )
{
	config.style = term.brightBlue ;
	//config.hintStyle = term.brightBlack.italic ;
	//config.autoCompleteHint = true ;
	return term.brightYellow ;
} ;



exports.autoComplete = function autoComplete( shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var token = lastTokenIsEndOfInput ? tokens[ tokens.length - 1 ] : '' ;
	var prefix = startString.slice( 0 , startString.length - token.length ) ;
	var result = shell.produceCompletion( gitCommands , token , true , prefix ) ;
	callback( undefined , result ) ;
} ;



exports.children = {
	clone: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: 'path'
	} ,
	status: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: 'path'
	} ,
	add: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: 'path'
	} ,
	rm: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.red ,
		autoComplete: 'path'
	} ,
	checkout: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: autoCompleteBranch
	} ,
	branch: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: autoCompleteBranch
	} ,
	merge: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: autoCompleteBranch
	} ,
	
	commit: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: false
	} ,
	tag: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: false
	} ,
	
	// Remote autoCompleter
	pull: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: autoCompleteRemote
	} ,
	push: {
		token: ( token , isEndOfInput , previousTokens , term , config ) => term.magenta ,
		autoComplete: autoCompleteRemote
	} ,
} ;



var gitCommands = Object.keys( exports.children ) ;



function autoCompleteBranch( shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var token = lastTokenIsEndOfInput ? tokens[ tokens.length - 1 ] : '' ;
	var prefix = startString.slice( 0 , startString.length - token.length ) ;
	
	execFile( 'git' , [ 'branch' ] , ( error , stdout ) => {
		if ( error ) { callback( undefined , startString ) ; return ; }
		
		var branches = stdout.split( '\n' ).slice( 0 , -1 ).map( e => e.slice( 2 ) ) ;
		var result = shell.produceCompletion( branches , token , true , prefix ) ;
		callback( undefined , result ) ;
	} ) ;
} ;



function autoCompleteRemote( shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var token = lastTokenIsEndOfInput ? tokens[ tokens.length - 1 ] : '' ;
	var prefix = startString.slice( 0 , startString.length - token.length ) ;
	
	execFile( 'git' , [ 'remote' ] , ( error , stdout ) => {
		if ( error ) { callback( undefined , startString ) ; return ; }
		
		var branches = stdout.split( '\n' ).slice( 0 , -1 ) ;
		var result = shell.produceCompletion( branches , token , true , prefix ) ;
		callback( undefined , result ) ;
	} ) ;
} ;


