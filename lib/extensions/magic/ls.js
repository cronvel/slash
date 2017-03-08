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



exports.token = function token( token , isEndOfInput , previousTokens , term , config )
{
	return term.magenta ;
} ;



exports.autoComplete = function autoComplete( shell , startString , tokens , lastTokenIsEndOfInput , callback )
{
	var token = tokens[ tokens.length - 1 ] ;
	
	if ( ! lastTokenIsEndOfInput || token[ 0 ] !== '-' )
	{
		// This is not an option, fallback to the builtin path auto-completer
		return shell.autoCompleters.path( shell , startString , tokens , lastTokenIsEndOfInput , callback ) ;
	}
	
	var prefix = startString.slice( 0 , startString.length - token.length ) ;
	
	var result = shell.produceCompletion( lsOptions , token , true , prefix ) ;
    callback( undefined , result ) ;
} ;



var lsOptions = [
	'-a' , '--all' ,
	'-A' , '--almost-all' ,
	'--author' ,
	'-b' , '--escape' ,
	'--block-size=' ,
	'-B' , '--ignore-backups' ,
	'-c' ,
	'-C' ,
	'--color' ,
	'-d' , '--directory' ,
	'-D' , '--dired' ,
	'-f' ,
	'-F' , '--classify' ,
	'--file-type' ,
	'--format=' ,
	'--full-time' ,
	'-g' ,
	'--group-directories-first' ,
	'-G' , '--no-group' ,
	'-h' , '--human-readable' ,
	'--si' ,
	'-H' , '--dereference-command-line' ,
	'--dereference-command-line-symlink-to-dir' ,
	'--hide=' ,
	'--indicator-style=none' ,
	'--indicator-style=slash' ,
	'--indicator-style=file-type' ,
	'--indicator-style=classify' ,
	'-i' , '--inode' ,
	'-I' , '--ignore=' ,
	'-k' , '--kibibytes' ,
	'-l' ,
	'-L' , '--dereference' ,
	'-m' ,
	'-n' , '--numeric-uid-gid' ,
	'-N' , '--literal' ,
	'-o' ,
	'-p' ,
	'-q' , '--hide-control-chars' ,
	'--show-control-chars' ,
	'-Q' , '--quote-name' ,
	'--quoting-style=' ,
	'-r' , '--reverse' ,
	'-R' , '--recursive' ,
	'-s' , '--size' ,
	'-S' ,
	'--sort=' ,
	'--time=' ,
	'--time-style=' ,
	'-t' ,
	'-T' , '--tabsize=' ,
	'-u' ,
	'-U' ,
	'-v' ,
	'-w' , '--width=' ,
	'-x' ,
	'-X' ,
	'-Z' , '--context' ,
	'-1' ,
	'--help' ,
	'--version'
] ;


